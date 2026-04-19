import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-20 items-start">
          {/* Brand */}
          <div className="space-y-3">
            <Link to="/" className="text-3xl font-serif text-foreground inline-block">
              YogaBrie
            </Link>
            <p className="text-muted-foreground font-serif leading-relaxed">
              Yoga & Pilates in the heart of Oslo.
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium">Contact</p>
            <address className="not-italic space-y-1 text-foreground font-sans text-sm leading-relaxed">
              <p>Brageveien 5 A</p>
              <p>0358 Oslo, Norway</p>
              <p className="pt-1">
                <a href="tel:+4745501078" className="hover:text-primary transition-colors">+47 455 01 078</a>
              </p>
              <p>
                <a href="mailto:contact@yogabrie.com" className="hover:text-primary transition-colors">contact@yogabrie.com</a>
              </p>
            </address>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium">Studio</p>
            <nav className="flex flex-col space-y-2 text-sm font-sans">
              <Link to="/classes" className="text-foreground hover:text-primary transition-colors">Classes</Link>
              <Link to="/teachers" className="text-foreground hover:text-primary transition-colors">Instructors</Link>
              <Link to="/joinnow" className="text-foreground hover:text-primary transition-colors">Memberships</Link>
              <Link to="/dashboard" className="text-foreground hover:text-primary transition-colors">My bookings</Link>
            </nav>
            <div className="flex gap-4 pt-2">
              <a href="https://www.instagram.com/yogabrie" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-sans">Instagram</a>
              <a href="https://www.facebook.com/yogabrie" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-sans">Facebook</a>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border text-sm text-muted-foreground font-sans flex justify-between items-center">
          <span>© 2026 YogaBrie</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
