import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingSheet from "@/components/BookingSheet";
import program1 from "@/assets/program-1.webp";
import program2 from "@/assets/program-2.webp";
import program3 from "@/assets/program-3.webp";
import program4 from "@/assets/program-4.webp";
import program5 from "@/assets/program-5.webp";
import program6 from "@/assets/program-6.webp";
import program7 from "@/assets/program-7.webp";
import program8 from "@/assets/program-8.webp";
import program9 from "@/assets/program-9.webp";
import gallery1 from "@/assets/gallery-1.webp";
import gallery2 from "@/assets/gallery-2.webp";
import plan1 from "@/assets/plan-1.webp";
import plan2 from "@/assets/plan-2.webp";
import featureBg from "@/assets/feature-bg.webp";

const programs = [
  { img: program1, title: "Finding your focus", coach: "Natalie", style: "Vinyasa", duration: "60 min", level: "Level 2" },
  { img: program2, title: "Move towards grace", coach: "Stefanie", style: "Vinyasa", duration: "90 min", level: "Level 3" },
  { img: program3, title: "Slow an anxious mind", coach: "Kelsey", style: "Meditation", duration: "25 min", level: "Level 1" },
  { img: program4, title: "Unlock your flexibility", coach: "Natalie", style: "Breathwork", duration: "30 min", level: "Level 1" },
  { img: program5, title: "Learn to fly", coach: "Damien", style: "Vinyasa", duration: "90 min", level: "Level 2" },
];

const morePrograms = [
  { img: program6, title: "Find your midline", coach: "Natalie", style: "Vinyasa", duration: "90 min", level: "Level 2" },
  { img: program7, title: "Quiet your body", coach: "Audrey", style: "Restorative", duration: "20 min", level: "Level 1" },
  { img: program8, title: "Cooling breath", coach: "Natalie", style: "Breathwork", duration: "5 min", level: "Level 1" },
  { img: program9, title: "Rooting down", coach: "Jaqui", style: "Prenatal", duration: "60 min", level: "Level 2" },
];

const collections = [
  { img: gallery1, title: "Yoga principles", desc: "Deepen your understanding of the foundational principles of yoga in this class designed for both beginners and experienced practitioners.", count: "12 classes" },
  { img: gallery2, title: "Rise & shine", desc: "An ideal choice for meditation beginners, Rise & Shine is a week-long program designed to help you greet the day with deeper clarity and vision.", count: "7 classes" },
  { img: plan1, title: "Go with the flow", desc: "This power flow collection incorporates over 84 traditional Hatha poses to maximize your flow experience and promote full body flexibility.", count: "18 classes" },
  { img: plan2, title: "Breaking barriers", desc: "Challenge yourself to better hold poses and deepen your stretches with this yin-focused yoga collection. All levels welcome.", count: "24 classes" },
];

const ClassDetail = ({ coach, style, duration, level }: { coach: string; style: string; duration: string; level: string }) => (
  <div className="space-y-1">
    <p className="text-sm text-foreground font-serif">
      {style} <em className="font-serif">with</em> {coach}
    </p>
    <p className="text-sm text-muted-foreground font-sans">
      {duration} · {level}
    </p>
  </div>
);

const Programs = () => {
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="py-24 lg:py-36">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <h1 className="text-2xl lg:text-4xl font-serif text-foreground leading-relaxed animate-fade-in max-w-4xl">
            Whether you're looking to try a beginner-level class or gain unlimited access to our library, we've got options to flex with your unique practice goals.
          </h1>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24 lg:pb-36">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-5 lg:row-span-2">
            <div className="group">
              <img src={programs[0].img} alt={programs[0].title} className="w-full aspect-[3/4] object-cover hover:opacity-90 transition-opacity" loading="lazy" />
              <h3 className="text-2xl font-serif text-foreground mt-5 mb-3">{programs[0].title}</h3>
              <ClassDetail {...programs[0]} />
            </div>
          </div>
          <div className="lg:col-span-7 grid grid-cols-2 gap-6 lg:gap-8 content-start">
            {programs.slice(1, 3).map((p) => (
              <div key={p.title} className="group">
                <img src={p.img} alt={p.title} className="w-full aspect-[4/3] object-cover hover:opacity-90 transition-opacity" loading="lazy" />
                <h3 className="text-xl font-serif text-foreground mt-4 mb-2">{p.title}</h3>
                <ClassDetail {...p} />
              </div>
            ))}
            {programs.slice(3, 5).map((p) => (
              <div key={p.title} className="group">
                <img src={p.img} alt={p.title} className="w-full aspect-[4/3] object-cover hover:opacity-90 transition-opacity" loading="lazy" />
                <h3 className="text-xl font-serif text-foreground mt-4 mb-2">{p.title}</h3>
                <ClassDetail {...p} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-warm-olive py-24 lg:py-36">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="text-3xl lg:text-5xl font-serif text-white mb-16">Collections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {collections.map((c) => (
              <div key={c.title} className="group">
                <img src={c.img} alt={c.title} className="w-full aspect-[3/4] object-cover hover:opacity-90 transition-opacity" loading="lazy" />
                <h3 className="text-xl font-serif text-white mt-6 mb-3 group-hover:opacity-80 transition-opacity">{c.title}</h3>
                <p className="text-sm text-white/80 leading-relaxed font-serif mb-3">{c.desc}</p>
                <p className="text-sm text-white/60 italic font-serif">{c.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-36">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-7 grid grid-cols-2 gap-6 lg:gap-8 content-start">
            {morePrograms.slice(0, 4).map((p) => (
              <div key={p.title} className="group">
                <img src={p.img} alt={p.title} className="w-full aspect-[4/3] object-cover hover:opacity-90 transition-opacity" loading="lazy" />
                <h3 className="text-xl font-serif text-foreground mt-4 mb-2">{p.title}</h3>
                <ClassDetail {...p} />
              </div>
            ))}
          </div>
          <div className="lg:col-span-5">
            <div className="group">
              <img src={featureBg} alt="Clearing away the fog" className="w-full aspect-[3/4] lg:aspect-auto lg:h-full object-cover hover:opacity-90 transition-opacity" loading="lazy" />
              <h3 className="text-2xl font-serif text-foreground mt-5 mb-3">Clearing away the fog</h3>
              <ClassDetail coach="Gabbi" style="Sound bath" duration="45 min" level="Level 1" />
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-6 lg:mx-8 mb-24 lg:mb-36">
        <div className="max-w-7xl mx-auto overflow-hidden">
          <div className="relative">
            <img src={gallery1} alt="" className="w-full h-[400px] lg:h-[500px] object-cover" aria-hidden="true" />
            <div className="absolute inset-0 bg-foreground/30" />
            <div className="absolute inset-0 flex items-center justify-between px-8 lg:px-16">
              <h2 className="text-2xl lg:text-4xl font-serif text-white leading-tight max-w-md italic">
                Get unlimited access to each of these featured classes and more.
              </h2>
              <div className="text-right space-y-4">
                <h3 className="text-xl lg:text-2xl font-serif text-white">Unlimited Yoga & Meditation</h3>
                <p className="text-white/80 font-serif text-sm">Improve your practice at your own pace.</p>
                <p className="text-3xl lg:text-4xl font-serif text-white">$49/mo</p>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="inline-block bg-warm-blush hover:bg-warm-blush/80 text-foreground px-8 py-3 font-sans font-medium text-sm uppercase tracking-wider transition-all"
                >
                  Book a Session
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <BookingSheet isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
};

export default Programs;
