import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import SignUpSheet from "@/components/SignUpSheet";
import BookingSheet from "@/components/BookingSheet";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { label: "Programs", path: "/classes" },
  { label: "Coaches", path: "/teachers" },
  { label: "Certification", path: "/joinnow" },
  { label: "Blog", path: "/journal" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  return (
    <>
      <header className="bg-header border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between py-5">
          <Link to="/" className="text-2xl font-serif text-foreground">
            VitalPath
          </Link>

          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-sans font-medium uppercase tracking-wider transition-colors duration-200 ${
                  location.pathname === item.path
                    ? "text-primary border-b border-primary pb-1"
                    : "text-foreground hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={() => setBookingOpen(true)}
              className="border border-foreground/30 hover:border-primary text-foreground px-5 py-2.5 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
            >
              Book a Session
            </button>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="bg-primary hover:bg-primary/80 text-primary-foreground px-6 py-2.5 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
              >
                Dashboard
              </Link>
            ) : (
              <button
                onClick={() => setSheetOpen(true)}
                className="bg-primary hover:bg-primary/80 text-primary-foreground px-6 py-2.5 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
              >
                Start Free Trial
              </button>
            )}
          </div>

          <button
            className="lg:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 top-[65px] bg-background z-50 overflow-y-auto animate-fade-in">
            <nav className="flex flex-col p-6 space-y-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`text-xl font-serif ${
                    location.pathname === item.path
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <hr className="border-border" />
              <button
                onClick={() => {
                  setMobileOpen(false);
                  setBookingOpen(true);
                }}
                className="border border-foreground/30 text-foreground px-6 py-3 font-sans font-medium text-center text-sm uppercase tracking-wider rounded-lg"
              >
                Book a Session
              </button>
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="bg-primary text-primary-foreground px-6 py-3 font-sans font-medium text-center text-sm uppercase tracking-wider rounded-lg"
                >
                  Dashboard
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setSheetOpen(true);
                  }}
                  className="bg-primary text-primary-foreground px-6 py-3 font-sans font-medium text-center text-sm uppercase tracking-wider rounded-lg"
                >
                  Start Free Trial
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      <SignUpSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
      <BookingSheet isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
    </>
  );
};

export default Header;
