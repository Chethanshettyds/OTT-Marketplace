import { Suspense, lazy, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';

const Scene3D = lazy(() => import('../../canvas/Scene3D'));

const PLATFORMS = [
  { name: 'Netflix', color: '#E50914', letter: 'N' },
  { name: 'Spotify', color: '#1DB954', letter: 'S' },
  { name: 'Disney+', color: '#113CCF', letter: 'D+' },
  { name: 'Prime', color: '#00A8E0', letter: 'P' },
  { name: 'YouTube', color: '#FF0000', letter: 'YT' },
  { name: 'HBO', color: '#5822B4', letter: 'HBO' },
];

const FEATURES = [
  { icon: 'pi-shield', title: 'Secure Payments', desc: 'JWT-secured wallet with Stripe integration' },
  { icon: 'pi-bolt', title: 'Instant Delivery', desc: 'Credentials delivered immediately after purchase' },
  { icon: 'pi-percentage', title: 'Up to 80% Off', desc: 'Genuine subscriptions at unbeatable prices' },
  { icon: 'pi-headphones', title: '24/7 Support', desc: 'Real-time ticket support with live chat' },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo('.land-title', { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power4.out' })
      .fromTo('.land-sub', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
      .fromTo('.land-cta', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.4');
  }, []);

  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-16">
        {/* 3D background */}
        <div className="absolute inset-0 opacity-50">
          <Suspense fallback={null}>
            <Scene3D
              products={PLATFORMS.map((p, i) => ({
                _id: String(i),
                platform: p.name,
                price: 4.99,
                gradientFrom: p.color,
                gradientTo: p.color + '88',
              }))}
              height="100%"
            />
          </Suspense>
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900/50 via-transparent to-dark-900" />

        <div className="relative z-10 text-center max-w-5xl mx-auto px-4">
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm text-indigo-300 mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Trusted by 10,000+ subscribers worldwide
          </motion.div>

          <h1 className="land-title text-6xl md:text-8xl font-black text-white leading-none mb-6">
            Stream More,{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Pay Less
            </span>
          </h1>

          <p className="land-sub text-xl md:text-2xl text-white/50 max-w-2xl mx-auto mb-10">
            Premium OTT subscriptions — Netflix, Spotify, Disney+ and more — at up to 80% off retail price.
          </p>

          <div className="land-cta flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/shop">
              <motion.button
                className="btn-primary px-10 py-4 text-lg font-bold rounded-2xl neon-border"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                <i className="pi pi-shopping-bag mr-2" />
                Shop Now
              </motion.button>
            </Link>
            <Link to="/signup">
              <motion.button
                className="btn-ghost px-10 py-4 text-lg font-bold rounded-2xl"
                whileHover={{ scale: 1.05 }}
              >
                <i className="pi pi-user-plus mr-2" />
                Get Started Free
              </motion.button>
            </Link>
          </div>

          {/* Platform logos */}
          <div className="flex items-center justify-center gap-4 mt-16 flex-wrap">
            {PLATFORMS.map((p, i) => (
              <motion.div
                key={p.name}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm glass border border-white/10"
                style={{ background: `${p.color}20`, borderColor: `${p.color}30` }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                whileHover={{ scale: 1.1, y: -4 }}
              >
                {p.letter}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-24 max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-white font-bold text-4xl mb-4">Why Choose OTT Market?</h2>
          <p className="text-white/40 text-lg">Everything you need for affordable streaming</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className="glass rounded-2xl p-6 border border-white/10 text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <i className={`pi ${f.icon} text-white text-xl`} />
              </div>
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-white/40 text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 text-center px-4">
        <div className="max-w-2xl mx-auto glass rounded-3xl p-12 border border-white/10">
          <h2 className="text-white font-black text-4xl mb-4">Ready to save?</h2>
          <p className="text-white/50 mb-8">Join thousands already saving on their streaming bills.</p>
          <Link to="/signup">
            <motion.button
              className="btn-primary px-10 py-4 text-lg font-bold rounded-2xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              Start Saving Today
            </motion.button>
          </Link>
        </div>
      </section>
    </div>
  );
}
