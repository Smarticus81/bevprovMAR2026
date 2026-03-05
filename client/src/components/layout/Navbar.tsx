import { Link } from "wouter";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.header 
      className="fixed top-0 w-full z-50 px-6 py-8 flex justify-between items-center text-xs tracking-widest uppercase font-medium text-white/70"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      <div className="flex items-center gap-12">
        <Link href="/" className="text-white text-xl tracking-tight normal-case font-semibold mr-4">
          BevOne
        </Link>
        <nav className="hidden md:flex gap-8">
          <Link href="#agents" className="hover:text-white transition-colors">Agents</Link>
          <Link href="#integrations" className="hover:text-white transition-colors">Integrations</Link>
          <Link href="#venues" className="hover:text-white transition-colors">Venues</Link>
          <Link href="#company" className="hover:text-white transition-colors">Company</Link>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <button className="hidden md:block hover:text-white transition-colors">Sign In</button>
        <button className="border border-white/20 rounded-full px-5 py-2 hover:bg-white hover:text-black transition-all duration-300">
          Start Building
        </button>
      </div>
    </motion.header>
  );
}
