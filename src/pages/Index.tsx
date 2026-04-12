import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SignUpSheet from "@/components/SignUpSheet";
import BookingSheet from "@/components/BookingSheet";
import gallery1 from "@/assets/gallery-1.webp";
import gallery2 from "@/assets/gallery-2.webp";
import content1 from "@/assets/content-1.webp";
import featureBg from "@/assets/feature-bg.webp";
import heroYoga from "@/assets/hero-yoga-cutout.webp";
import plan1 from "@/assets/plan-1.webp";
import plan2 from "@/assets/plan-2.webp";
import plan3 from "@/assets/plan-3.webp";
import newsletter from "@/assets/newsletter.webp";
import program1 from "@/assets/program-1.webp";
import program2 from "@/assets/program-2.webp";
import program3 from "@/assets/program-3.webp";
import blog1 from "@/assets/blog-1.webp";
import blog2 from "@/assets/blog-2.webp";
import blog3 from "@/assets/blog-3.webp";
import blog4 from "@/assets/blog-4.webp";
import blog5 from "@/assets/blog-5.webp";
import blog6 from "@/assets/blog-6.webp";

const blogSlugs = [
  "building-wellness-habits",
  "home-fitness-sanctuary",
  "discomfort-essential-growth",
  "perfect-squat",
  "finding-balance",
  "20-minute-workout",
];

const blogTitles = [
  "Building Wellness Habits That Last",
  "Creating Your Home Fitness Sanctuary",
  "Why Discomfort Is Essential for Growth",
  "Mastering the Perfect Squat",
  "Finding Balance in a Busy World",
  "The 20-Minute Workout That Changes Everything",
];

const Index = () => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative min-h-screen overflow-hidden bg-header">
        {/* Layer 1: Blob SVG */}
        <div className="absolute z-[1] right-[-5%] top-[5%] w-[60%] h-[90%] pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 800 800" className="w-full h-full">
            <defs>
              <filter id="blob-blur"><feGaussianBlur stdDeviation="30" /></filter>
            </defs>
            <path
              fill="hsl(var(--primary))"
              filter="url(#blob-blur)"
              d="M 400 100 C 550 80 700 200 720 380 C 740 560 650 720 480 740 C 310 760 150 650 120 470 C 90 290 250 120 400 100 Z"
            />
          </svg>
        </div>

        {/* Layer 2: Person cutout */}
        <div className="absolute inset-0 z-[2] flex items-end justify-end pr-[2%]">
          <img
            src={heroYoga}
            alt="Woman in seated yoga meditation pose"
            className="h-[105%] w-auto object-contain max-w-none"
            width={1080}
            height={1080}
          />
        </div>

        {/* Layer 3: Text */}
        <div className="relative z-[3] flex items-center min-h-screen pl-[8%] lg:pl-[10%] pr-6">
          <div className="max-w-xl py-32">
            <h1 className="text-primary-foreground text-4xl lg:text-6xl font-serif leading-tight animate-fade-in">
              A holistic health platform that empowers you to take charge of your wellness, no matter where life takes you.
            </h1>
            <button
              onClick={() => setSheetOpen(true)}
              className="inline-block mt-8 bg-primary hover:bg-primary/80 text-primary-foreground px-10 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200 animate-fade-in-delay"
            >
              Start your journey
            </button>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div>
            <img src={gallery1} alt="Member completing Full-Body Strength program" className="w-full aspect-[4/5] object-cover rounded-lg hover:opacity-90 transition-opacity duration-500" loading="lazy" width={800} height={1000} />
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed italic font-serif">
              Member Sarah completing Full-Body Strength with Coach Marcus in her home gym
            </p>
          </div>
          <div className="lg:mt-20">
            <img src={gallery2} alt="Coach Elena leading Mindful Mornings" className="w-full aspect-[4/5] object-cover rounded-lg hover:opacity-90 transition-opacity duration-500" loading="lazy" width={800} height={1000} />
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed italic font-serif">
              Coach Elena leading Mindful Mornings from her studio
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-24 lg:py-36">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <img src={content1} alt="Yoga practice" className="w-full aspect-[3/4] object-cover rounded-lg" loading="lazy" width={800} height={1066} />
          <div className="space-y-8">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium">Build your routine</p>
            <h2 className="text-3xl lg:text-5xl font-serif text-foreground leading-tight">Find wellness that fits your lifestyle</h2>
            <p className="text-lg text-muted-foreground leading-relaxed font-serif">
              We've designed three membership tiers to support your unique health goals. Whether you're beginning your fitness journey, seeking unlimited access to diverse programming, or training to become a certified wellness coach—we have a plan that adapts to your needs and grows with you.
            </p>
            <Link to="/joinnow" className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200">
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      {/* Marquee CTA */}
      <section className="bg-secondary py-20 overflow-hidden rounded-3xl max-w-[98%] mx-auto my-4">
        <p className="text-center text-foreground/60 text-sm uppercase tracking-[0.2em] mb-10 font-sans font-medium">
          Build a lifestyle that makes you
        </p>
        <div className="space-y-4">
          <div className="flex whitespace-nowrap animate-marquee">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="text-5xl lg:text-7xl font-serif text-foreground mr-12">
                STRONGER · ENERGIZED · RESILIENT ·
              </span>
            ))}
          </div>
          <div className="flex whitespace-nowrap animate-marquee-reverse">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="text-5xl lg:text-7xl font-serif text-foreground mr-12">
                CENTERED · NOURISHED · CONFIDENT ·
              </span>
            ))}
          </div>
          <div className="flex whitespace-nowrap animate-marquee-slow">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="text-5xl lg:text-7xl font-serif text-foreground mr-12">
                V · I · T · A · L · I · Z · E · D ·
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="py-24 lg:py-36">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <img src={featureBg} alt="Expert coaches" className="w-full aspect-[3/4] object-cover rounded-lg" loading="lazy" />
          <div className="space-y-8">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium">Our coaches</p>
            <h2 className="text-3xl lg:text-5xl font-serif text-foreground leading-tight">
              Expert coaches committed to your transformation
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed font-serif">
              Our certified coaches specialize in everything from fitness and nutrition to mental wellness and habit formation. What unites them? A genuine passion for helping you build sustainable health habits that enhance every aspect of your life.
            </p>
            <Link to="/teachers" className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200">
              Meet the coaches
            </Link>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-36">
        <h2 className="text-3xl lg:text-5xl font-serif text-foreground text-center mb-20">Choose your path</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {[
            { img: plan1, name: "Foundation", desc: "Begin your wellness journey with our Foundation plan. Access curated programs and community support to build healthy habits." },
            { img: plan2, name: "Unlimited Access", desc: "Unlock your full potential with unlimited access to all programs, live sessions, personalized coaching, and community events." },
            { img: plan3, name: "Wellness Coach Certification", desc: "Transform lives including your own through our comprehensive 300-hour wellness coach certification program." },
          ].map((plan) => (
            <div key={plan.name} className="bg-card rounded-xl p-6 text-center">
              <img src={plan.img} alt={plan.name} className="w-full aspect-[3/4] object-cover rounded-lg mb-8" loading="lazy" />
              <h3 className="text-2xl font-serif text-card-foreground mb-4">{plan.name}</h3>
              <p className="text-muted-foreground leading-relaxed font-serif mb-6">{plan.desc}</p>
              <Link to="/joinnow" className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-3 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all">
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Styles & Formats */}
      <section className="py-24 lg:py-36">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start mb-16">
            <img src={program1} alt="HIIT workout" className="w-full aspect-[3/4] object-cover rounded-lg hover:opacity-90 transition-opacity" loading="lazy" />
            <div className="space-y-8 lg:pt-20">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium">Programs</p>
              <h2 className="text-3xl lg:text-5xl font-serif text-foreground leading-tight">With diverse programs and formats to match your goals</h2>
              <p className="text-lg text-muted-foreground leading-relaxed font-serif">
                Our library spans from gentle mobility sessions to high-intensity workouts, nutrition workshops to meditation series—ensuring there's something for every wellness seeker at every stage.
              </p>
              <Link to="/classes" className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200">
                Explore programs
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 lg:gap-8">
            <div className="lg:mt-12">
              <img src={program2} alt="Pilates" className="w-full aspect-[4/5] object-cover rounded-lg hover:opacity-90 transition-opacity" loading="lazy" />
            </div>
            <div>
              <img src={program3} alt="Meditation" className="w-full aspect-[4/5] object-cover rounded-lg hover:opacity-90 transition-opacity" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Blog */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-36">
        <h2 className="text-3xl lg:text-5xl font-serif text-foreground mb-16">From The Blog</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12 lg:gap-x-8 lg:gap-y-16">
          {[blog1, blog2, blog3, blog4, blog5, blog6].map((img, i) => (
            <Link key={i} to={`/insights/${blogSlugs[i]}`} className="group">
              <img
                src={img}
                alt={blogTitles[i]}
                className={`w-full object-cover rounded-lg group-hover:opacity-90 transition-opacity ${
                  i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-square" : "aspect-[4/5]"
                }`}
                loading="lazy"
              />
              <h3 className="mt-4 text-lg font-serif text-foreground group-hover:text-primary transition-colors">{blogTitles[i]}</h3>
            </Link>
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link to="/journal" className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all">
            Read more
          </Link>
        </div>
      </section>

      {/* Full-width CTA Banner */}
      <section className="relative py-32 lg:py-48 rounded-3xl max-w-[98%] mx-auto my-4 overflow-hidden">
        <img src={newsletter} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-foreground/40" />
        <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
          <h2 className="text-4xl lg:text-6xl font-serif text-primary-foreground leading-tight mb-8">Make space for yourself</h2>
          <button
            onClick={() => setSheetOpen(true)}
            className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-10 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all"
          >
            Start your journey
          </button>
        </div>
      </section>

      <Footer />
      <SignUpSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
      <BookingSheet isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
};

export default Index;
