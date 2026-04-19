import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingSheet from "@/components/BookingSheet";

const instructors = [
  {
    img: "/images/instructors/brinkela.avif",
    name: "Brinkela Gjokaj",
    specialty: "Ashtanga Yoga & Pilates",
    bio: "Brinkela has nearly a decade of professional practice built through multiple teacher trainings and numerous trips to India. She emphasises safety and alignment, tailoring each session to meet the unique needs of every student. She believes that yoga and Pilates are disciplines for everyone, regardless of experience or background.",
    classes: ["Ashtanga Mysore", "Pilates", "Mama & Baby Pilates", "Ashtanga for Parents", "Ashtanga Full Led"],
  },
  {
    img: "/images/instructors/olga.avif",
    name: "Olga Kotsi",
    specialty: "Dance, Yoga & Pilates",
    bio: "With over 20 years of movement experience, Olga holds International Dance Teacher's Association (IDTA) diplomas and trained at the American Dance School in Bob Fosse technique. She has performed at Eurovision, MAD Music Awards, and various TV productions, and now channels that energy into yoga and Pilates teaching.",
    classes: ["Gentle Flow", "Bootylicious", "Private Sessions"],
  },
  {
    img: "/images/instructors/julie.avif",
    name: "Julie",
    specialty: "Yoga & Meditation",
    bio: "Julie holds a Master's degree in Economics and Marketing with a focus on Mindfulness in Decision-Making. A practitioner since 2018, she creates a warm and grounding space where students can slow down, find balance, and recharge. Her sessions blend movement with mindfulness.",
    classes: ["Yin Yoga", "Gentle Flow", "Meditation"],
  },
];

const Coaches = () => {
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-20 lg:py-32 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-4">The team</p>
        <h1 className="text-3xl lg:text-5xl font-serif text-foreground leading-relaxed">
          Dedicated teachers committed to supporting your practice.
        </h1>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24 lg:pb-36 space-y-24 lg:space-y-36">
        {instructors.map((instructor, i) => (
          <div
            key={instructor.name}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
              i % 2 === 1 ? "lg:grid-flow-dense" : ""
            }`}
          >
            <img
              src={instructor.img}
              alt={instructor.name}
              className={`w-full aspect-[3/4] object-cover rounded-lg ${i % 2 === 1 ? "lg:col-start-2" : ""}`}
              loading="lazy"
            />
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl lg:text-4xl font-serif text-foreground">{instructor.name}</h2>
                <p className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground mt-2">{instructor.specialty}</p>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed font-serif">{instructor.bio}</p>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-2">Classes</p>
                <div className="flex flex-wrap gap-2">
                  {instructor.classes.map((cls) => (
                    <span key={cls} className="text-xs font-sans px-3 py-1.5 bg-secondary rounded-full text-foreground">
                      {cls}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setBookingOpen(true)}
                className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
              >
                Book a Session
              </button>
            </div>
          </div>
        ))}
      </section>

      <Footer />
      <BookingSheet isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
};

export default Coaches;
