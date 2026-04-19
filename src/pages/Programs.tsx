import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingSheet from "@/components/BookingSheet";

const classes = [
  {
    img: "/images/classes/Mysore.png",
    name: "Ashtanga Mysore",
    instructor: "Brinkela Gjokaj",
    duration: "Up to 110 min",
    level: "All levels",
    schedule: "Mon–Fri 7:00–8:50 · Sun 9:00–10:45",
    desc: "Traditional self-paced Ashtanga practice. Each student works through the sequence at their own pace with individual guidance from the teacher. No prior experience needed — everyone starts from the beginning.",
  },
  {
    img: "/images/classes/Ashtanga-clean.png",
    name: "Pilates (Mat)",
    instructor: "Brinkela Gjokaj",
    duration: "45 min",
    level: "All levels",
    schedule: "Mon–Fri 9:00 · Sat–Sun 11:00 · Mon–Thu 18:00",
    desc: "Full-body movement focusing on core strength, breath, and body awareness. Suitable for all fitness levels and particularly good for building a strong foundation.",
  },
  {
    img: "/images/classes/mamma.png",
    name: "Mama & Baby Pilates",
    instructor: "Brinkela Gjokaj",
    duration: "45 min",
    level: "All levels",
    schedule: "Mon & Thu 11:00 · Sat 14:00",
    desc: "Gentle postpartum class for new mothers with infants. Focuses on recovery, core reconnection, and bonding. Babies are welcome on the mat.",
  },
  {
    img: "/images/classes/Ashtanga.png",
    name: "Ashtanga for Parents",
    instructor: "Brinkela Gjokaj",
    duration: "45 min",
    level: "All levels",
    schedule: "Tue & Fri 11:00",
    desc: "Practice the Primary Series while caring for your children. A supportive environment where babies and small children are welcome to be present.",
  },
  {
    img: "/images/classes/Ashtanga.png",
    name: "Ashtanga Full Led",
    instructor: "Brinkela Gjokaj",
    duration: "90 min",
    level: "Intermediate",
    schedule: "Fri 16:30 · Sat 9:30",
    desc: "Teacher-led complete Primary Series using the traditional Sanskrit count. All movements are called by the teacher. Some prior Mysore experience recommended.",
  },
  {
    img: "/images/classes/Yinyoga.png",
    name: "Yin Yoga",
    instructor: "Julie",
    duration: "50 min",
    level: "All levels",
    schedule: "Mon & Wed 18:50 · Fri 18:00",
    desc: "Slow, meditative practice with longer-held poses targeting the deep connective tissues. A perfect counterbalance to the dynamic Ashtanga and Pilates classes.",
  },
  {
    img: "/images/classes/Ashtanga-clean.png",
    name: "Gentle Flow",
    instructor: "Olga Kotsi",
    duration: "50 min",
    level: "All levels",
    schedule: "Tue 18:50",
    desc: "Soft, fluid movement for tension release and increased flexibility. Accessible for beginners and those recovering from injury.",
  },
  {
    img: "/images/classes/Ashtanga.png",
    name: "Ashtanga Led Standing",
    instructor: "Brinkela Gjokaj",
    duration: "50 min",
    level: "All levels",
    schedule: "Thu 18:50",
    desc: "Guided standing sequence from the Primary Series with step-by-step instruction. Great for beginners building familiarity with the Ashtanga method.",
  },
  {
    img: "/images/classes/Ashtanga-clean.png",
    name: "Bootylicious",
    instructor: "Olga Kotsi",
    duration: "30 min",
    level: "All levels",
    schedule: "Sun 11:50",
    desc: "Lower-body focused strength and cardio blend. Short, effective, and fun.",
  },
];

const Programs = () => {
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-20 lg:py-32 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-4">What we offer</p>
        <h1 className="text-3xl lg:text-5xl font-serif text-foreground leading-relaxed mb-6">
          Classes for every body, every level.
        </h1>
        <p className="text-lg text-muted-foreground font-serif max-w-2xl mx-auto">
          From traditional Ashtanga Mysore to Pilates, Yin Yoga, and specialist classes for parents and new mothers. Book any class through our booking flow.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24 lg:pb-36">
        <div className="space-y-6">
          {classes.map((cls) => (
            <div
              key={cls.name}
              className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-6 items-center bg-card rounded-xl p-6 lg:p-8"
            >
              <img
                src={cls.img}
                alt={cls.name}
                className="w-full lg:w-[280px] aspect-[4/3] object-cover rounded-lg"
                loading="lazy"
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-xl lg:text-2xl font-serif text-card-foreground">{cls.name}</h2>
                  <span className="text-xs font-sans font-medium uppercase tracking-wider bg-secondary text-foreground px-3 py-1 rounded-full">
                    {cls.level}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-sans leading-relaxed">{cls.desc}</p>
                <div className="flex flex-wrap gap-4 pt-2 text-xs font-sans text-muted-foreground">
                  <span><span className="font-medium text-foreground">Instructor:</span> {cls.instructor}</span>
                  <span><span className="font-medium text-foreground">Duration:</span> {cls.duration}</span>
                </div>
                <p className="text-xs font-sans text-muted-foreground pt-1">
                  <span className="font-medium text-foreground">Schedule:</span> {cls.schedule}
                </p>
              </div>
              <div className="lg:self-center">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="w-full lg:w-auto whitespace-nowrap bg-primary hover:bg-primary/80 text-primary-foreground px-6 py-3 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
                >
                  Book
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
      <BookingSheet isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
};

export default Programs;
