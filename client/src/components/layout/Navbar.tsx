import { Link } from "wouter";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.header 
      className="fixed top-0 w-full z-50 mix-blend-difference p-6 flex justify-between items-start text-white pointer-events-none"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <Link href="/" className="font-display text-5xl md:text-7xl leading-none pointer-events-auto hover:text-primary transition-colors tracking-widest">
        BEVONE
      </Link>

      <div className="flex flex-col items-end gap-1 font-mono text-[10px] md:text-xs uppercase pointer-events-auto">
        <Link href="#modules" className="hover:text-primary transition-colors">Modules [01]</Link>
        <Link href="#architecture" className="hover:text-primary transition-colors">Architecture [02]</Link>
        <button className="mt-6 border-2 border-white px-6 py-2 hover:bg-white hover:text-black transition-all active:scale-95 font-bold tracking-widest bg-black/20 backdrop-blur-sm">
          INITIALIZE
        </button>
      </div>
    </motion.header>
  );
}
