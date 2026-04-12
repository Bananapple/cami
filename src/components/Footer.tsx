import { Link } from "react-router-dom";
import { toast } from "sonner";

const Footer = ({ tagline }: { tagline?: string }) => {
  return (
    <footer className="bg-card border-t border-border py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left — Brand */}
          <div className="space-y-4">
            <Link to="/" className="text-3xl font-serif text-foreground inline-block">
              VitalPath
            </Link>
            {tagline && <p className="text-lg text-muted-foreground font-serif">{tagline}</p>}
            <p className="text-muted-foreground font-serif leading-relaxed max-w-md">
              A holistic wellness platform empowering you to build sustainable health habits that enhance every aspect of your life.
            </p>
          </div>

          {/* Right — Newsletter */}
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium">Subscribe to our newsletter</p>
            <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); toast("Subscribed! Check your inbox."); }}>
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-5 py-3 border border-border bg-transparent text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none rounded-md transition-all font-sans"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary/80 text-primary-foreground px-6 py-3 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border text-sm text-muted-foreground font-sans flex justify-between items-center">
          <span>© 2024 VitalPath</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
