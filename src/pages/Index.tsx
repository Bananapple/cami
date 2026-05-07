import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { posthog } from "@/integrations/posthog";
import { supabase } from "@/integrations/supabase/client";
import { googleCalendarUrl } from "@/lib/calendar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingSheet from "@/components/BookingSheet";

const classes = [
  {
    img: "/images/classes/Mysore.avif",
    name: "Ashtanga Mysore",
    desc: "Self-paced practice with individual guidance from the teacher.",
    level: "All levels",
  },
  {
    img: "/images/classes/Ashtanga-clean.avif",
    name: "Pilates",
    desc: "Full-body movement focusing on core strength and control.",
    level: "All levels",
  },
  {
    img: "/images/classes/Yinyoga.avif",
    name: "Yin Yoga",
    desc: "Slow, meditative practice with longer-held poses for deep release.",
    level: "All levels",
  },
  {
    img: "/images/classes/mamma.avif",
    name: "Mama & Baby Pilates",
    desc: "Gentle postpartum movement for new mothers and their infants.",
    level: "All levels",
  },
  {
    img: "/images/classes/Ashtanga.avif",
    name: "Ashtanga Full Led",
    desc: "Teacher-led Primary Series using the traditional Sanskrit count.",
    level: "Intermediate",
  },
];

const instructors = [
  {
    img: "/images/instructors/brinkela.avif",
    name: "Brinkela Gjokaj",
    specialty: "Ashtanga & Pilates",
    bio: "Nearly a decade of professional practice, multiple teacher trainings, and numerous trips to India. Brinkela believes these disciplines are for everyone.",
  },
  {
    img: "/images/instructors/olga.avif",
    name: "Olga Kotsi",
    specialty: "Dance, Yoga & Pilates",
    bio: "Over 20 years of movement experience spanning jazz, hip-hop, Ashtanga, and Pilates. Performs at Eurovision and MAD Music Awards.",
  },
  {
    img: "/images/instructors/julie.avif",
    name: "Julie",
    specialty: "Yoga & Meditation",
    bio: "Practitioner since 2018, bringing warmth and mindfulness to every session. Creates a grounding space to slow down and recharge.",
  },
];

const shopProducts = [
  {
    img: "/images/shop/dropin.jpeg",
    name: "Drop-in",
    price: "kr 250",
    desc: "Single class, no commitment.",
  },
  {
    img: "/images/shop/clipcard10.jpeg",
    name: "10× Clip Card",
    price: "kr 2,300",
    desc: "Ten classes at a reduced rate.",
  },
  {
    img: "/images/shop/allincl.jpeg",
    name: "All-Inclusive",
    price: "kr 1,600 / month",
    desc: "Unlimited access to all classes.",
  },
  {
    img: "/images/shop/private60mn.jpeg",
    name: "Private Session (60 min)",
    price: "kr 1,500",
    desc: "One-on-one instruction, your pace.",
  },
];

const Index = () => {
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const bookingId = params.get("booking_id");
    if (status === "success") {
      posthog.capture("booking_completed", { booking_id: bookingId, price: undefined });

      // Fetch class details to build calendar link
      if (bookingId) {
        supabase
          .from("bookings")
          .select("class_instances ( starts_at, ends_at, class_templates ( name ), locations ( name ) )")
          .eq("id", bookingId)
          .single()
          .then(({ data }) => {
            const ci = (data as any)?.class_instances;
            const calUrl = ci?.starts_at && ci?.ends_at
              ? googleCalendarUrl({
                  title: ci.class_templates?.name ?? "Yoga class",
                  startsAt: ci.starts_at,
                  endsAt: ci.ends_at,
                  location: ci.locations?.name,
                })
              : null;

            toast.success("Booking confirmed!", {
              description: "You're all set. See you on the mat.",
              duration: 8000,
              ...(calUrl ? {
                action: {
                  label: "Add to calendar →",
                  onClick: () => window.open(calUrl, "_blank"),
                },
              } : {}),
            });
          });
      } else {
        toast.success("Booking confirmed!", {
          description: "You're all set. See you on the mat.",
          duration: 6000,
        });
      }
    } else if (status === "cancelled") {
      toast.info("Booking not completed", {
        description: "Your payment was cancelled. No charge was made.",
        duration: 5000,
      });
    }
    if (status) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero — full-bleed photo */}
      <section className="relative min-h-screen overflow-hidden">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/hero/hero2.avif" />
          <img
            src="/images/hero/hero1.avif"
            alt="YogaBrie studio"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 bg-foreground/40" />
        <div className="relative z-10 flex items-center justify-center md:justify-start min-h-screen px-8 lg:px-16">
          <div className="max-w-2xl text-center md:text-left">
            <p className="text-sm font-sans font-medium uppercase tracking-[0.2em] text-primary-foreground/70 mb-4">
              Brageveien 5 A · Oslo
            </p>
            <h1 className="text-5xl lg:text-7xl font-serif text-primary-foreground leading-tight mb-8">
              Yoga &amp; Pilates<br />in the heart<br />of Oslo.
            </h1>
            <button
              onClick={() => setBookingOpen(true)}
              className="block mx-auto md:inline-block md:mx-0 bg-primary hover:bg-primary/80 text-primary-foreground px-10 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
            >
              Book a Session
            </button>
          </div>
        </div>
      </section>

      {/* Studio intro */}
      <section className="py-24 lg:py-36">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <img
            src="/images/facility/outside1.avif"
            alt="YogaBrie studio exterior"
            className="w-full aspect-[4/5] object-cover rounded-lg"
            loading="lazy"
          />
          <div className="space-y-8">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium">About the studio</p>
            <h2 className="text-3xl lg:text-5xl font-serif text-foreground leading-tight">
              Simplicity, authenticity, and the power of community.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed font-serif">
              YogaBrie is a welcoming space where practitioners of all levels can advance their practice. We combine traditional Ashtanga yoga with Pilates instruction, serving everyone from beginners to experienced practitioners — including parents, new mothers, and corporate groups.
            </p>
            <address className="not-italic text-sm font-sans text-muted-foreground space-y-1">
              <p>Brageveien 5 A, 0358 Oslo</p>
              <p><a href="tel:+4745501078" className="hover:text-foreground transition-colors">+47 455 01 078</a></p>
              <p><a href="mailto:contact@yogabrie.com" className="hover:text-foreground transition-colors">contact@yogabrie.com</a></p>
            </address>
            <button
              onClick={() => setBookingOpen(true)}
              className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
            >
              Book a Session
            </button>
          </div>
        </div>
      </section>

      {/* Classes */}
      <section className="py-24 lg:py-36 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-3">What we offer</p>
              <h2 className="text-3xl lg:text-5xl font-serif text-foreground">Our classes</h2>
            </div>
            <Link to="/classes" className="hidden lg:inline-block text-sm font-sans font-medium uppercase tracking-wider text-foreground hover:text-primary transition-colors border-b border-foreground/30 hover:border-primary pb-1">
              View all classes
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {classes.map((cls, i) => (
              <div
                key={cls.name}
                className={`group cursor-pointer ${i === 2 ? "sm:col-span-2 lg:col-span-1" : ""}`}
                onClick={() => setBookingOpen(true)}
              >
                <div className="overflow-hidden rounded-lg">
                  <img
                    src={cls.img}
                    alt={cls.name}
                    className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-serif text-foreground">{cls.name}</h3>
                    <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{cls.level}</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-sans leading-relaxed">{cls.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 lg:hidden text-center">
            <Link to="/classes" className="inline-block text-sm font-sans font-medium uppercase tracking-wider text-foreground hover:text-primary transition-colors border-b border-foreground/30 hover:border-primary pb-1">
              View all classes
            </Link>
          </div>
        </div>
      </section>

      {/* Instructors */}
      <section className="py-24 lg:py-36">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-3">The team</p>
              <h2 className="text-3xl lg:text-5xl font-serif text-foreground">Meet our instructors</h2>
            </div>
            <Link to="/teachers" className="hidden lg:inline-block text-sm font-sans font-medium uppercase tracking-wider text-foreground hover:text-primary transition-colors border-b border-foreground/30 hover:border-primary pb-1">
              Full profiles
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {instructors.map((instructor, i) => (
              <div key={instructor.name} className={i === 1 ? "md:mt-12" : ""}>
                <img
                  src={instructor.img}
                  alt={instructor.name}
                  className="w-full aspect-[3/4] object-cover rounded-lg"
                  loading="lazy"
                />
                <div className="mt-5">
                  <h3 className="text-xl font-serif text-foreground">{instructor.name}</h3>
                  <p className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground mt-1 mb-3">{instructor.specialty}</p>
                  <p className="text-sm text-muted-foreground font-sans leading-relaxed">{instructor.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop / Memberships */}
      <section className="py-24 lg:py-36 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-3">Pricing</p>
              <h2 className="text-3xl lg:text-5xl font-serif text-foreground">Memberships &amp; classes</h2>
            </div>
            <Link to="/joinnow" className="hidden lg:inline-block text-sm font-sans font-medium uppercase tracking-wider text-foreground hover:text-primary transition-colors border-b border-foreground/30 hover:border-primary pb-1">
              See all options
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {shopProducts.map((product) => (
              <div key={product.name} className="bg-card rounded-xl overflow-hidden">
                <img
                  src={product.img}
                  alt={product.name}
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <div className="p-5">
                  <h3 className="font-serif text-lg text-card-foreground">{product.name}</h3>
                  <p className="text-sm text-muted-foreground font-sans mt-1 mb-3 leading-relaxed">{product.desc}</p>
                  <p className="font-sans font-medium text-foreground">{product.price}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/joinnow" className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200">
              All memberships &amp; products
            </Link>
          </div>
        </div>
      </section>

      {/* Blog stub */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-36">
        <h2 className="text-3xl lg:text-5xl font-serif text-foreground mb-4">From the Blog</h2>
        <p className="text-muted-foreground font-serif text-lg">Our journal is coming soon.</p>
      </section>

      {/* Full-width CTA */}
      <section className="relative py-32 lg:py-48 rounded-3xl max-w-[98%] mx-auto my-4 overflow-hidden">
        <img
          src="/images/facility/outside2.avif"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-foreground/50" />
        <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
          <h2 className="text-4xl lg:text-6xl font-serif text-primary-foreground leading-tight mb-4">
            Reserve your spot.
          </h2>
          <p className="text-primary-foreground/80 font-serif text-lg mb-8">
            Classes fill up. Book early to secure your place on the mat.
          </p>
          <button
            onClick={() => setBookingOpen(true)}
            className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-10 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all"
          >
            Book a Session
          </button>
        </div>
      </section>

      <Footer />
      <BookingSheet isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
};

export default Index;
