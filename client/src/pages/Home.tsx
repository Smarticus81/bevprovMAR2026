import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { ArrowRight, Terminal, WifiOff, ShieldAlert, Cpu } from "lucide-react";

// This will be resolved once the video is generated
import champagneVideo from "@/assets/videos/champagne-bg.mp4";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/50">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative h-[100dvh] w-full bg-black text-white overflow-hidden flex flex-col justify-end p-6 md:p-12 pb-24 border-b-2 border-white">
        <div className="absolute inset-0 z-0">
          <video 
            src={champagneVideo} 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="w-full h-full object-cover opacity-70 grayscale contrast-125" 
          />
          <div className="absolute inset-0 bg-black/30"></div>
        </div>
        
        <div className="relative z-10 w-full">
          <motion.h1 
            className="font-display text-[15vw] md:text-[12vw] leading-[0.8] tracking-tighter mix-blend-difference uppercase"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            POUR<br/>
            <span className="text-outline">PERFECTION.</span>
          </motion.h1>

          <motion.div 
            className="flex flex-col lg:flex-row justify-between items-start lg:items-end mt-12 border-t-2 border-white/20 pt-8 gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            <p className="font-mono text-sm md:text-base max-w-xl uppercase tracking-widest text-white/80 leading-relaxed">
              The all-in-one platform for event venues, bartenders, and managers. <br/><br/>
              <span className="text-primary font-bold bg-primary/10 px-2 py-1 border border-primary/30">
                Built to handle the friday night rush.
              </span>
            </p>

            <div className="flex flex-col items-start lg:items-end font-mono text-xs md:text-sm text-primary uppercase gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-ping"></span>
                SYSTEM: ONLINE
              </div>
              <div>SPEED: LIGHTNING FAST</div>
              <div>SECURITY: BANK-GRADE</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="border-b-2 border-white bg-primary text-black py-4 font-display text-4xl tracking-widest marquee-container uppercase">
        <div className="marquee-content">
          NEVER LOSE AN ORDER • KEEP THE DRINKS FLOWING • FLAWLESS INVENTORY TRACKING • EFFORTLESS EVENT BOOKING • NEVER LOSE AN ORDER • KEEP THE DRINKS FLOWING • FLAWLESS INVENTORY TRACKING • EFFORTLESS EVENT BOOKING •
        </div>
      </div>

      {/* MODULES GRID */}
      <section id="modules" className="bg-white text-black py-24 md:py-40 px-6 md:px-12">
        <div className="border-b-[4px] border-black pb-4 mb-20 md:mb-32 flex justify-between items-end">
          <h2 className="font-display text-7xl md:text-[9rem] leading-[0.8] tracking-tighter">EVERYTHING<br/>YOU NEED.</h2>
          <span className="font-mono text-sm hidden md:block uppercase font-bold">/// Three Core Tools</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-[4px] border-black bg-black">
          {/* POS */}
          <div className="bg-white border-b-[4px] md:border-b-0 md:border-r-[4px] border-black p-8 md:p-16 hover:bg-black hover:text-white transition-colors duration-300 group flex flex-col justify-between">
            <div className="font-mono text-sm md:text-base mb-24 md:mb-40 font-bold tracking-widest border-b-2 border-black group-hover:border-white pb-2">
              01 // POINT OF SALE
            </div>
            <div>
              <h3 className="font-display text-6xl md:text-8xl mb-6 leading-none">BEVPRO<br/>POS</h3>
              <p className="font-sans text-xl font-medium leading-relaxed text-black/70 group-hover:text-white/70">
                A lightning-fast register that works even when the WiFi goes down. Process payments and keep the line moving, no matter what.
              </p>
            </div>
          </div>
          
          {/* VA */}
          <div className="bg-white border-b-[4px] md:border-b-0 md:border-r-[4px] border-black p-8 md:p-16 hover:bg-black hover:text-white transition-colors duration-300 group flex flex-col justify-between">
            <div className="font-mono text-sm md:text-base mb-24 md:mb-40 font-bold tracking-widest border-b-2 border-black group-hover:border-white pb-2 text-primary">
              02 // EVENT MANAGER
            </div>
            <div>
              <h3 className="font-display text-6xl md:text-8xl mb-6 leading-none text-primary">VENUE<br/>ASSISTANT</h3>
              <p className="font-sans text-xl font-medium leading-relaxed text-black/70 group-hover:text-white/70">
                Your AI-powered booking coordinator. Handle inquiries, schedule events, and manage your calendar hands-free.
              </p>
            </div>
          </div>
          
          {/* INV */}
          <div className="bg-white p-8 md:p-16 hover:bg-black hover:text-white transition-colors duration-300 group flex flex-col justify-between">
            <div className="font-mono text-sm md:text-base mb-24 md:mb-40 font-bold tracking-widest border-b-2 border-black group-hover:border-white pb-2">
              03 // STOCK CONTROL
            </div>
            <div>
              <h3 className="font-display text-6xl md:text-8xl mb-6 leading-none">SMART<br/>INVENTORY</h3>
              <p className="font-sans text-xl font-medium leading-relaxed text-black/70 group-hover:text-white/70">
                Know exactly what you poured versus what you sold. Automated ordering ensures you never run out of your best sellers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE SECTION */}
      <section id="architecture" className="py-24 md:py-40 bg-black text-white px-6 md:px-12 border-t-2 border-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24">
          <div>
            <h2 className="font-display text-6xl md:text-8xl leading-[0.8] mb-12">
              BUILT FOR<br/>THE REAL<br/><span className="text-primary text-outline-primary">WORLD.</span>
            </h2>
            
            <div className="font-mono text-sm md:text-base text-white/70 space-y-6 max-w-lg">
              <p>
                We know what a Friday night feels like. Sticky fingers, dropped internet connections, and a line out the door.
              </p>
              <p>
                BevOne is designed to be <span className="text-white font-bold bg-white/10 px-2 py-1">bulletproof</span> when you need it most.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { icon: WifiOff, title: "WORKS OFFLINE", desc: "If the internet drops, you keep ringing up orders. Everything syncs later." },
              { icon: ShieldAlert, title: "TOTAL PRIVACY", desc: "Your venue's data is locked down and completely separated from everyone else." },
              { icon: Cpu, title: "VOICE ASSISTANT", desc: "Talk to your system to get things done faster. No more tapping through menus." },
              { icon: Terminal, title: "ZERO MISTAKES", desc: "Smart safeguards prevent accidental orders and keep your numbers perfect." }
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start border-2 border-white/20 p-6 md:p-8 hover:border-primary transition-colors hover:bg-white/5">
                <item.icon className="w-10 h-10 md:w-12 md:h-12 text-primary shrink-0" strokeWidth={1.5} />
                <div>
                  <h4 className="font-display text-3xl md:text-4xl tracking-wide mb-2">{item.title}</h4>
                  <p className="font-mono text-sm md:text-base text-white/60">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-40 md:py-64 bg-primary text-black flex flex-col items-center justify-center text-center px-6 border-y-[4px] border-black overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none"></div>
        
        <h2 className="font-display text-[12vw] leading-[0.8] tracking-tighter mix-blend-multiply relative z-10">
          OWN THE NIGHT.
        </h2>
        
        <button className="mt-16 md:mt-24 font-display text-4xl md:text-6xl border-[4px] border-black px-12 md:px-20 py-6 hover:bg-black hover:text-primary transition-all active:scale-95 uppercase tracking-widest relative z-10 group shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-3 hover:translate-y-3">
          GET STARTED <ArrowRight className="inline-block ml-4 w-10 h-10 group-hover:translate-x-4 transition-transform" strokeWidth={3} />
        </button>
      </section>

      {/* FOOTER */}
      <footer className="bg-black text-white p-6 md:p-12 font-mono text-xs md:text-sm uppercase flex flex-col md:flex-row justify-between items-center md:items-start gap-8 border-t-[4px] border-white">
        <div>
          <div className="font-display text-4xl mb-4 tracking-widest">BEVONE //</div>
          <div className="text-white/50">© 2026 // ALL RIGHTS RESERVED.</div>
        </div>
        <div className="flex gap-8 text-white/70">
          <a href="#" className="hover:text-primary transition-colors">OPERATIONS</a>
          <a href="#" className="hover:text-primary transition-colors">INTELLIGENCE</a>
          <a href="#" className="hover:text-primary transition-colors">TERMINAL</a>
        </div>
      </footer>
    </div>
  );
}
