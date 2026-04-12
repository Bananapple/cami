import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import coach1 from "@/assets/coach-1.webp";
import coach2 from "@/assets/coach-2.webp";
import coach3 from "@/assets/coach-3.webp";
import coach4 from "@/assets/coach-4.webp";
import coach5 from "@/assets/coach-5.webp";
import coachWide from "@/assets/coach-wide.webp";
import featureBg from "@/assets/feature-bg.webp";

const coaches = [
  { img: coach1, name: "Jaya Dixon", specialty: "Restorative & Meditation" },
  { img: coach2, name: "Lindsey Beumer", specialty: "Ashtanga, Vinyasa, Breathwork" },
  { img: coach3, name: "Emmett Marsh", specialty: "Hatha" },
  { img: coach4, name: "Dallas Moreno", specialty: "Ashtanga, Vinyasa" },
  { img: coach5, name: "Jamie Kokot", specialty: "Meditation" },
  { img: featureBg, name: "Jackie Krall", specialty: "Meditation, Breathwork" },
];

const Coaches = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-20 lg:py-32 text-center">
        <h1 className="text-3xl lg:text-5xl font-serif text-foreground leading-relaxed animate-fade-in">
          At VitalPath, we've built a dynamic team of yoga & meditation experts to help expand your practice.
        </h1>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-20 lg:pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {coaches.map((coach) => (
            <div key={coach.name} className="group">
              <img
                src={coach.img}
                alt={coach.name}
                className="w-full aspect-[3/4] object-cover rounded-lg hover:opacity-90 transition-opacity"
                loading="lazy"
              />
              <h3 className="text-xl font-serif text-foreground mt-5">{coach.name}</h3>
              <p className="text-base font-serif italic text-muted-foreground">{coach.specialty}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="relative rounded-lg overflow-hidden">
          <img src={coachWide} alt="Teacher training" className="w-full aspect-[21/9] object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-foreground/20" />
          <div className="absolute inset-0 flex items-center justify-end px-8 lg:px-16">
            <div className="text-right max-w-md space-y-6">
              <h2 className="text-2xl lg:text-4xl font-serif text-white leading-tight italic">
                Go deeper with expert guidance in our 300-hr teacher training
              </h2>
              <Link to="/joinnow" className="inline-block bg-warm-blush hover:bg-warm-blush/80 text-foreground px-10 py-3 font-sans font-medium text-sm uppercase tracking-wider transition-all rounded-lg">
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Coaches;
