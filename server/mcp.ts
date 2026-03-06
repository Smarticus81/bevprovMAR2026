import { Router, Request, Response } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
import { executeToolCall, getOpenAIToolDefinitions, autoEnableToolsForAgent } from "./tools";

const mcpRouter = Router();

const JSONRPC_VERSION = "2.0";
const MCP_PROTOCOL_VERSION = "2024-11-05";

interface JsonRpcRequest {
  jsonrpc: string;
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, error: { code, message, data } };
}

function jsonRpcResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

mcpRouter.post("/api/mcp/:agentId", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const agentId = parseInt(req.params.agentId as string);

    if (isNaN(agentId)) {
      return res.status(400).json(jsonRpcError(null, -32600, "Invalid agentId"));
    }

    const agent = await storage.getAgentById(agentId, user.organizationId);
    if (!agent) {
      return res.status(404).json(jsonRpcError(null, -32600, "Agent not found"));
    }

    const body = req.body as JsonRpcRequest;

    if (!body.jsonrpc || body.jsonrpc !== JSONRPC_VERSION) {
      return res.status(400).json(jsonRpcError(body.id ?? null, -32600, "Invalid JSON-RPC version"));
    }

    if (!body.method) {
      return res.status(400).json(jsonRpcError(body.id ?? null, -32600, "Method is required"));
    }

    const requestId = body.id ?? null;

    switch (body.method) {
      case "initialize": {
        return res.json(jsonRpcResult(requestId, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: `bevpro-${agent.name}`,
            version: "1.0.0",
          },
        }));
      }

      case "tools/list": {
        let enabledTools = await storage.getToolsByAgent(agent.id);
        if (enabledTools.length === 0) {
          enabledTools = await autoEnableToolsForAgent(agent.id, agent.type);
        }
        const toolDefs = getOpenAIToolDefinitions(enabledTools);

        const mcpTools = toolDefs.map((t: any) => ({
          name: t.name,
          description: t.description,
          inputSchema: {
            type: "object",
            ...t.parameters,
          },
        }));

        return res.json(jsonRpcResult(requestId, { tools: mcpTools }));
      }

      case "tools/call": {
        const params = body.params || {};
        const toolName = params.name as string;
        const toolArgs = (params.arguments as Record<string, unknown>) || {};

        if (!toolName) {
          return res.json(jsonRpcError(requestId, -32602, "Tool name is required in params.name"));
        }

        let enabledToolsForCall = await storage.getToolsByAgent(agent.id);
        if (enabledToolsForCall.length === 0) {
          enabledToolsForCall = await autoEnableToolsForAgent(agent.id, agent.type);
        }
        const enabledToolNames = enabledToolsForCall.filter(t => t.enabled).map(t => t.toolName);

        if (!enabledToolNames.includes(toolName)) {
          return res.json(jsonRpcError(requestId, -32602, `Tool "${toolName}" is not available for this agent`));
        }

        const result = await executeToolCall(toolName, toolArgs, user.organizationId);

        return res.json(jsonRpcResult(requestId, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.result),
            },
          ],
          isError: !result.success,
        }));
      }

      case "ping": {
        return res.json(jsonRpcResult(requestId, {}));
      }

      default: {
        return res.json(jsonRpcError(requestId, -32601, `Method "${body.method}" not found`));
      }
    }
  } catch (error: any) {
    console.error("MCP error:", error);
    return res.status(500).json(jsonRpcError(null, -32603, "Internal error: " + error.message));
  }
});

mcpRouter.get("/api/mcp/:agentId", requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  const agentId = parseInt(req.params.agentId as string);

  if (isNaN(agentId)) {
    return res.status(400).json({ error: "Invalid agentId" });
  }

  const agent = await storage.getAgentById(agentId, user.organizationId);
  if (!agent) {
    return res.status(404).json({ error: "Agent not found" });
  }

  let enabledTools = await storage.getToolsByAgent(agent.id);
  if (enabledTools.length === 0) {
    enabledTools = await autoEnableToolsForAgent(agent.id, agent.type);
  }
  const toolDefs = getOpenAIToolDefinitions(enabledTools);

  return res.json({
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: {
      name: `bevpro-${agent.name}`,
      version: "1.0.0",
    },
    capabilities: {
      tools: { listChanged: false },
    },
    toolCount: toolDefs.length,
    tools: toolDefs.map((t: any) => t.name),
    endpoint: `/api/mcp/${agentId}`,
    usage: "POST JSON-RPC 2.0 requests with methods: initialize, tools/list, tools/call, ping",
  });
});

export { mcpRouter };
