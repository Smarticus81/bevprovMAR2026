import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { ArrowRight, Mic, CreditCard, Box, CheckCircle2 } from "lucide-react";

// The video will be available at this path once generated
import heroVideo from "@/assets/videos/hero-bg.mp4";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center pt-20">
        {/* Video Background */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
          <div className="absolute inset-0 bg-background/60 z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10"></div>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover scale-105"
            src={heroVideo}
          />
        </div>

        <div className="container relative z-20 px-6 md:px-12 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <span className="inline-block py-1 px-3 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-6 backdrop-blur-sm tracking-wide uppercase">
              The Next Era of Hospitality
            </span>
          </motion.div>
          
          <motion.h1 
            className="text-5xl md:text-7xl lg:text-8xl font-serif mb-6 leading-tight text-white"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            Run your venue with <br className="hidden md:block"/>
            <span className="italic text-primary">intelligent</span> elegance.
          </motion.h1>
          
          <motion.p 
            className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 font-light"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
          >
            BevOne is the multi-tenant SaaS platform that empowers event venues and hospitality operators with voice-powered operations, seamless payments, and effortless inventory.
          </motion.p>
          
          <motion.div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
          >
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 h-14 text-lg w-full sm:w-auto shadow-[0_0_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)] transition-all">
              Discover BevOne <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-lg w-full sm:w-auto border-white/20 hover:bg-white/5 text-white">
              Watch the Film
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Flagship Modules Section */}
      <section id="solutions" className="py-32 relative z-10">
        <div className="container px-6 md:px-12 mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-serif mb-6">Designed for the rush. <br/><span className="italic text-white/60">Built for scale.</span></h2>
            <p className="text-white/60 text-lg">Three flagship modules sharing a common intelligent runtime, crafted to perform flawlessly under pressure.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "BevPro POS",
                icon: <CreditCard className="w-8 h-8 text-primary" />,
                desc: "Lightning-fast, offline-first point of sale. Process real payments effortlessly, even when the WiFi drops mid-service.",
                features: ["Offline Queueing", "Stripe Terminal", "Tab Management"]
              },
              {
                title: "Venue Assistant",
                icon: <Mic className="w-8 h-8 text-primary" />,
                desc: "Voice-powered AI administration. Handle bookings, answer inquiries, and manage your calendar completely hands-free.",
                features: ["Realtime Voice AI", "Automated Comms", "Smart Scheduling"]
              },
              {
                title: "Smart Inventory",
                icon: <Box className="w-8 h-8 text-primary" />,
                desc: "Procurement and variance tracking that actually makes sense. Know exactly what you poured versus what you sold.",
                features: ["Automated POs", "Real-time Depletion", "Variance Reports"]
              }
            ].map((module, i) => (
              <motion.div 
                key={i}
                className="glass-card rounded-3xl p-8 hover:-translate-y-2 transition-transform duration-500 group"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, delay: i * 0.2 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  {module.icon}
                </div>
                <h3 className="text-2xl font-serif mb-4">{module.title}</h3>
                <p className="text-white/60 mb-8 leading-relaxed">{module.desc}</p>
                <ul className="space-y-3">
                  {module.features.map((feature, j) => (
                    <li key={j} className="flex items-center text-sm text-white/80">
                      <CheckCircle2 className="w-4 h-4 mr-3 text-primary/70" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech/Trust Section */}
      <section className="py-32 relative border-t border-white/5 bg-white/[0.02]">
        <div className="container px-6 md:px-12 mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-5xl font-serif mb-6">Reliability is our <br/><span className="text-primary italic">finest feature.</span></h2>
              <p className="text-lg text-white/60 mb-8 leading-relaxed">
                We know that Friday night at 11 PM is not the time for software updates. BevOne is architected for determinism and offline resilience. If the internet drops, you keep pouring.
              </p>
              
              <div className="space-y-6">
                {[
                  { title: "Offline-First POS", desc: "Local queues ensure orders process even without connection." },
                  { title: "Tenant Isolation", desc: "Absolute data security between venues." },
                  { title: "Ultra-Low Latency", desc: "Voice AI responses that feel like human conversation." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-serif italic">{i + 1}</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-1">{item.title}</h4>
                      <p className="text-white/50 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
          
          <div className="lg:w-1/2 w-full">
             <motion.div
              className="relative aspect-square rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
             >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent z-10 mix-blend-overlay"></div>
                <img 
                  src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop" 
                  alt="Elegant bar setting" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border border-white/20 rounded-[2.5rem] z-20 pointer-events-none"></div>
             </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="container px-6 md:px-12 mx-auto">
          <div className="glass-card rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
            
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-serif mb-6 text-white">Elevate your venue today.</h2>
              <p className="text-xl text-white/70 mb-10 font-light">Join the vanguard of hospitality operators using BevOne to streamline operations and deliver unforgettable experiences.</p>
              
              <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-full px-10 h-16 text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                Request Private Access
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="container px-6 md:px-12 mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="font-serif text-2xl tracking-wider text-white mb-6 md:mb-0">
            BevOne<span className="text-primary">.</span>
          </div>
          <div className="flex gap-8 text-sm text-white/50">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
