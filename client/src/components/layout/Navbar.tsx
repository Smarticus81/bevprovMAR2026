import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header 
      className={`fixed top-0 w-full z-50 transition-all duration-500 ease-in-out ${
        scrolled ? "glass py-4" : "bg-transparent py-6"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
        <Link href="/" className="font-serif text-2xl tracking-wider text-white hover:text-primary transition-colors">
          BevOne<span className="text-primary">.</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="#solutions" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
            Solutions
          </Link>
          <Link href="#platform" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
            Platform
          </Link>
          <Link href="#venues" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
            For Venues
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Button variant="ghost" className="hidden md:inline-flex text-white/80 hover:text-white hover:bg-white/10">
            Sign In
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6">
            Book Demo
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
