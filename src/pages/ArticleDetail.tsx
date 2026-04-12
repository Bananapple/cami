import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import blog1 from "@/assets/blog-1.webp";
import blog2 from "@/assets/blog-2.webp";
import blog3 from "@/assets/blog-3.webp";
import blog4 from "@/assets/blog-4.webp";
import blog5 from "@/assets/blog-5.webp";
import blog6 from "@/assets/blog-6.webp";
import blog7 from "@/assets/blog-7.webp";
import blog8 from "@/assets/blog-8.webp";

interface ArticleData {
  title: string;
  author: string;
  date: string;
  readTime: string;
  heroImg: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
  pullQuote: string;
  relatedSlugs: string[];
}

const articlesData: Record<string, ArticleData> = {
  "building-wellness-habits": {
    title: "Building wellness habits with your family",
    author: "Dr. Emily Chen",
    date: "November 15, 2024",
    readTime: "7 min read",
    heroImg: blog1,
    intro: "Creating a culture of health within your household doesn't require perfection—it requires consistency, creativity, and a willingness to meet each family member where they are. Here's how to make wellness a shared adventure rather than a chore.",
    sections: [
      { heading: "Start with shared meals", body: ["The dinner table is ground zero for family wellness. Research from Harvard's Family Dinner Project shows that families who eat together at least three times per week see measurable improvements in children's eating habits, academic performance, and emotional well-being.", "Begin by involving everyone in meal preparation. Even toddlers can wash vegetables or stir ingredients. The goal isn't culinary perfection—it's participation and connection."] },
      { heading: "Move together, not apart", body: ["Family fitness doesn't mean synchronized gym sessions. It means finding activities that everyone enjoys—evening walks, weekend hikes, dance parties in the living room, or backyard obstacle courses.", "The key is removing the pressure of 'exercise' and replacing it with the joy of movement. When kids see their parents moving with pleasure rather than obligation, they internalize a positive relationship with physical activity."] },
      { heading: "Create wellness rituals", body: ["Rituals anchor habits. A Sunday evening stretching session, a gratitude practice before bed, or a weekly family cooking challenge—these small traditions create the scaffolding for lasting behavioral change.", "Start with one ritual and protect it fiercely. Once it becomes automatic, add another. Within a few months, your family will have a wellness ecosystem that sustains itself."] },
    ],
    pullQuote: "Wellness isn't something you do to your family—it's something you build with them, one small habit at a time.",
    relatedSlugs: ["home-fitness-sanctuary", "mindful-eating-guide", "finding-balance"],
  },
  "home-fitness-sanctuary": {
    title: "Creating your home fitness sanctuary",
    author: "Marcus Williams",
    date: "November 8, 2024",
    readTime: "6 min read",
    heroImg: blog2,
    intro: "You don't need a commercial gym to build the body and mind you want. With thoughtful design and minimal equipment, any corner of your home can become a powerful training environment.",
    sections: [
      { heading: "Choose your space wisely", body: ["The ideal home workout space isn't necessarily the largest room—it's the one you'll actually use. A spare bedroom, garage corner, or even a cleared section of your living room can work beautifully.", "Prioritize natural light, ventilation, and a surface you can move freely on. A 6×8 foot area is enough for most bodyweight and dumbbell routines."] },
      { heading: "Essential equipment (less than you think)", body: ["Start with three items: a yoga mat, a set of resistance bands, and one pair of adjustable dumbbells. This trio covers 90% of exercises you'll ever need at home.", "As you progress, consider adding a pull-up bar (doorframe models cost under $30) and a stability ball. Avoid the temptation to buy everything at once—let your training needs guide your purchases."] },
      { heading: "Design for consistency", body: ["Your sanctuary should invite you in. Keep it tidy, add a Bluetooth speaker for music, and consider a small whiteboard to track your weekly goals. Visual cues—like leaving your mat rolled out—reduce friction between intention and action.", "The psychology of environment design is powerful: when your space says 'workout,' your brain follows."] },
    ],
    pullQuote: "The best gym in the world is the one you'll actually show up to—and that might be ten steps from your bed.",
    relatedSlugs: ["building-wellness-habits", "20-minute-workout", "perfect-squat"],
  },
  "discomfort-essential-growth": {
    title: "Why discomfort is essential for growth",
    author: "Sarah Martinez",
    date: "November 1, 2024",
    readTime: "8 min read",
    heroImg: blog3,
    intro: "We're wired to avoid discomfort, but the most meaningful transformations in fitness, career, and personal development happen just beyond the edge of our comfort zone.",
    sections: [
      { heading: "The biology of adaptation", body: ["Every time you lift a weight that challenges you, your muscle fibers experience microscopic tears. Your body repairs them stronger than before. This principle—called supercompensation—applies far beyond the gym.", "Psychological research shows identical patterns in cognitive and emotional development. Struggle, followed by recovery, produces growth. Without the struggle, there's nothing to adapt to."] },
      { heading: "Discomfort vs. pain: knowing the difference", body: ["Productive discomfort feels like effort, uncertainty, and mild anxiety. It's the burn in the last three reps, the nervousness before a presentation, the vulnerability of an honest conversation.", "Pain, on the other hand, is your body's warning system. Sharp, sudden, or escalating signals should never be ignored."] },
      { heading: "Building your discomfort tolerance", body: ["Start with cold showers—literally. Thirty seconds of cold water at the end of your shower teaches your nervous system that discomfort is survivable and temporary.", "Then apply the principle progressively: take on a conversation you've been avoiding, try a workout style that intimidates you, or learn a skill where you'll be a complete beginner."] },
    ],
    pullQuote: "Comfort is the enemy of progress. Not because comfort is bad, but because staying there forever means you'll never discover what you're truly capable of.",
    relatedSlugs: ["lessons-resilience-nature", "finding-balance", "20-minute-workout"],
  },
  "perfect-squat": {
    title: "Exercise 101: The perfect squat",
    author: "Alex Rivera",
    date: "October 24, 2024",
    readTime: "5 min read",
    heroImg: blog4,
    intro: "It all begins with proper form. The squat is the king of functional movements—we do it dozens of times daily without thinking.",
    sections: [
      { heading: "Setting up your stance", body: ["Stand with feet slightly wider than shoulder-width apart, toes pointed outward 15–30 degrees.", "Before you descend, brace your core as if someone were about to lightly push you."] },
      { heading: "The descent", body: ["Initiate the movement by simultaneously pushing your hips back and bending your knees.", "Descend until your hip crease drops below your knee line (parallel or deeper)."] },
      { heading: "Driving back up", body: ["Push through your entire foot—not just your heels—and squeeze your glutes at the top.", "A perfect rep takes about 2–3 seconds down and 1–2 seconds up."] },
    ],
    pullQuote: "Master the squat and you've mastered the foundation of human movement. Every other exercise builds on this pattern.",
    relatedSlugs: ["home-fitness-sanctuary", "discomfort-essential-growth", "20-minute-workout"],
  },
  "finding-balance": {
    title: "Finding balance in uncertain times",
    author: "Dr. Samira Patel",
    date: "October 17, 2024",
    readTime: "9 min read",
    heroImg: blog5,
    intro: "Uncertainty is not the exception—it's the baseline of modern life.",
    sections: [
      { heading: "Redefining balance", body: ["Balance isn't a fixed state you achieve and maintain. It's a dynamic process of constant micro-adjustments—like a surfer on a wave.", "When we stop chasing the myth of perfect balance and start practicing intentional imbalance, we paradoxically find more peace."] },
      { heading: "The anchor practices", body: ["Identify 2–3 non-negotiable daily practices that ground you regardless of what's happening around you.", "The practices themselves matter less than the consistency."] },
      { heading: "Embracing seasons", body: ["Life moves in seasons, and each season demands different things from us.", "Give yourself permission to redefine balance with each new season."] },
    ],
    pullQuote: "Balance isn't about standing still. It's about knowing which way to lean when the ground shifts beneath your feet.",
    relatedSlugs: ["building-wellness-habits", "lessons-resilience-nature", "mindful-eating-guide"],
  },
  "20-minute-workout": {
    title: "The power of a 20-minute workout",
    author: "Jordan Chen",
    date: "October 3, 2024",
    readTime: "5 min read",
    heroImg: blog6,
    intro: "Small changes create lasting results. If you think you need an hour at the gym to make progress, the science disagrees.",
    sections: [
      { heading: "Why 20 minutes works", body: ["A landmark study found that just 11 minutes of moderate-intensity exercise daily was associated with significantly reduced risk of heart disease, cancer, and premature death.", "The real advantage of short workouts isn't physiological—it's psychological."] },
      { heading: "Structuring your 20 minutes", body: ["Use a simple format: 3 minutes of dynamic warm-up, 14 minutes of work, 3 minutes of cool-down.", "Pair upper and lower body movements to maximize efficiency."] },
      { heading: "The compound effect", body: ["Twenty minutes per day equals 2.3 hours per week, or roughly 120 hours per year of training.", "After 30 days of daily 20-minute workouts, most people report improved energy, better sleep, and a noticeable shift in body composition."] },
    ],
    pullQuote: "The best workout isn't the longest one—it's the one you do every single day.",
    relatedSlugs: ["perfect-squat", "home-fitness-sanctuary", "discomfort-essential-growth"],
  },
  "lessons-resilience-nature": {
    title: "Lessons in resilience from nature",
    author: "David Thompson",
    date: "September 12, 2024",
    readTime: "7 min read",
    heroImg: blog7,
    intro: "What the natural world teaches us about adapting.",
    sections: [
      { heading: "The bamboo principle", body: ["Bamboo spends its first five years developing an extensive root system underground with almost no visible growth above the surface.", "Your wellness journey works the same way."] },
      { heading: "Adaptation over strength", body: ["The mightiest oak in the forest can be toppled by a storm, while the willow survives by bending.", "A flexible practice that adapts to your energy, schedule, and life circumstances endures."] },
      { heading: "The ecosystem approach", body: ["No organism thrives in isolation.", "Sleep affects your workouts. Nutrition affects your sleep. Stress affects your nutrition."] },
    ],
    pullQuote: "Nature doesn't hurry, yet everything is accomplished. Your wellness journey deserves the same patient, persistent approach.",
    relatedSlugs: ["discomfort-essential-growth", "finding-balance", "mindful-eating-guide"],
  },
  "mindful-eating-guide": {
    title: "A starter guide to mindful eating",
    author: "Maya Rodriguez",
    date: "September 5, 2024",
    readTime: "6 min read",
    heroImg: blog8,
    intro: "Transform your relationship with food. Mindful eating isn't a diet—it's a practice of awareness.",
    sections: [
      { heading: "What mindful eating actually is", body: ["Mindful eating is paying full attention to the experience of eating—the colors, smells, textures, flavors, temperatures, and even the sounds of your food.", "It's not about what you eat. It's about how you eat."] },
      { heading: "The five-breath start", body: ["Before each meal, take five slow breaths. This activates your parasympathetic nervous system.", "During these breaths, look at your plate. Notice the colors and arrangement."] },
      { heading: "Practical tips for daily life", body: ["Put your fork down between bites. Chew each bite 15–20 times. Eat at a table, not on the couch or at your desk.", "Start with just one mindful meal per day—breakfast is often the easiest."] },
    ],
    pullQuote: "When you truly taste your food, you need less of it to feel satisfied. Mindful eating is the opposite of deprivation—it's abundance through attention.",
    relatedSlugs: ["building-wellness-habits", "finding-balance", "lessons-resilience-nature"],
  },
};

const slugToImg: Record<string, string> = {
  "building-wellness-habits": blog1,
  "home-fitness-sanctuary": blog2,
  "discomfort-essential-growth": blog3,
  "perfect-squat": blog4,
  "finding-balance": blog5,
  "20-minute-workout": blog6,
  "lessons-resilience-nature": blog7,
  "mindful-eating-guide": blog8,
};

const ArticleDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? articlesData[slug] : null;

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-32 text-center">
          <h1 className="text-4xl font-serif text-foreground mb-4">Article Not Found</h1>
          <p className="text-lg text-muted-foreground mb-8">The article you're looking for doesn't exist.</p>
          <Link to="/journal" className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 rounded-lg font-medium transition-all">
            Browse Blog
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const relatedArticles = article.relatedSlugs
    .map((s) => articlesData[s] ? { slug: s, ...articlesData[s] } : null)
    .filter(Boolean) as (ArticleData & { slug: string })[];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative py-32 lg:py-44">
        <img src={article.heroImg} alt={article.title} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/50 to-foreground/20" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center space-y-6">
          <div className="flex items-center justify-center gap-4 text-sm text-primary-foreground/70">
            <span className="font-medium">{article.author}</span>
            <span className="w-1 h-1 rounded-full bg-primary-foreground/50" />
            <span>{article.date}</span>
            <span className="w-1 h-1 rounded-full bg-primary-foreground/50" />
            <span>{article.readTime}</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-serif text-primary-foreground leading-tight animate-fade-in">
            {article.title}
          </h1>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
        <p className="text-xl lg:text-2xl text-foreground leading-relaxed font-serif">{article.intro}</p>
      </section>

      <article className="max-w-3xl mx-auto px-6 lg:px-8 pb-16 space-y-12">
        {article.sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-2xl lg:text-3xl font-serif text-foreground mb-6">{section.heading}</h2>
            {section.body.map((p, j) => (
              <p key={j} className="text-lg text-muted-foreground leading-relaxed mb-4 font-serif">{p}</p>
            ))}
          </div>
        ))}
      </article>

      <section className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <blockquote className="text-2xl lg:text-3xl font-serif text-primary-foreground leading-snug italic">
            "{article.pullQuote}"
          </blockquote>
          <p className="mt-6 text-primary-foreground/70 font-medium font-serif">— {article.author}</p>
        </div>
      </section>

      {relatedArticles.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
          <h2 className="text-3xl lg:text-4xl font-serif text-foreground mb-12">Related articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {relatedArticles.map((ra) => (
              <Link to={`/insights/${ra.slug}`} key={ra.slug} className="group">
                <div className="overflow-hidden rounded-xl mb-4">
                  <img src={slugToImg[ra.slug]} alt={ra.title} className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <p className="text-sm text-muted-foreground mb-1 font-serif">{ra.author}</p>
                <h3 className="text-xl font-serif text-foreground group-hover:text-primary transition-colors">{ra.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-card py-20">
        <div className="max-w-2xl mx-auto px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl font-serif text-foreground">Enjoyed this article?</h2>
          <p className="text-lg text-muted-foreground font-serif">Subscribe for weekly wellness insights delivered to your inbox.</p>
          <form className="flex gap-3 max-w-md mx-auto" onSubmit={(e) => { e.preventDefault(); toast("Subscribed! Check your inbox."); }}>
            <input type="email" placeholder="Enter your email" className="flex-1 px-5 py-3 rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-all font-sans" />
            <button type="submit" className="bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-3 rounded-lg font-medium transition-all whitespace-nowrap font-sans text-sm uppercase tracking-wider">Subscribe</button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ArticleDetail;
