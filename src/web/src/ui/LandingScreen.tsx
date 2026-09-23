import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { setAppView } from './store';

export function LandingScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Create scroll-linked animations
  const { scrollYProgress } = useScroll({ container: containerRef });
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const opacityText = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  useEffect(() => {
    document.documentElement.classList.add('has-game-cursor');
    return () => {
      document.documentElement.classList.remove('has-game-cursor');
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    containerRef.current.style.setProperty('--mouse-x', `${x}px`);
    containerRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  const titleText = "MIRRORBOUND".split("");

  // Random floating shapes for background impact
  const shapes = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100 - 50 + "vw",
    y: Math.random() * 100 - 50 + "vh",
    scale: Math.random() * 1.5 + 0.5,
    rotate: Math.random() * 360,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 2,
    color: ['#FF4F00', '#6A00FF', '#00BFFF', '#FFEA00'][Math.floor(Math.random() * 4)],
    type: ['square', 'circle', 'triangle'][Math.floor(Math.random() * 3)]
  }));

  return (
    <div className="landing-screen neo-brutalist" ref={containerRef} onMouseMove={handleMouseMove}>
      <motion.div className="neo-bg-grid" style={{ y: gridY }} />
      <div className="neo-cursor-glow" />
      
      {/* Floating Background Particles */}
      <div className="neo-particles" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
        {shapes.map((s) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
            animate={{ 
              opacity: [0, 0.5, 0],
              x: s.x, 
              y: s.y, 
              rotate: s.rotate 
            }}
            transition={{
              duration: s.duration,
              delay: s.delay,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: s.type === 'square' ? '20px' : s.type === 'circle' ? '20px' : '0',
              height: s.type === 'square' ? '20px' : s.type === 'circle' ? '20px' : '0',
              backgroundColor: s.type !== 'triangle' ? s.color : 'transparent',
              borderRadius: s.type === 'circle' ? '50%' : '0',
              borderLeft: s.type === 'triangle' ? '10px solid transparent' : 'none',
              borderRight: s.type === 'triangle' ? '10px solid transparent' : 'none',
              borderBottom: s.type === 'triangle' ? `20px solid ${s.color}` : 'none',
              border: s.type !== 'triangle' ? '2px solid #0a0610' : 'none',
              scale: s.scale,
              boxShadow: s.type !== 'triangle' ? `4px 4px 0px #0a0610` : 'none'
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <section className="landing-section hero-section">
        <motion.div 
          className="neo-beta-badge"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            top: '40px',
            background: 'var(--neo-orange)',
            color: 'var(--neo-white)',
            padding: '8px 16px',
            fontFamily: 'var(--pixel)',
            fontSize: '18px',
            border: '4px solid var(--neo-dark)',
            boxShadow: '4px 4px 0px var(--neo-dark)',
            transform: 'rotate(-5deg)'
          }}
        >
          CLOSED BETA v0.1.0
        </motion.div>
        
        <motion.div className="hero-content" style={{ opacity: opacityText }}>
          <h1 className="neo-title">
            {titleText.map((char, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 50, rotateX: -90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.6, delay: index * 0.08, type: "spring", stiffness: 150 }}
                className="neo-title-char"
              >
                {char}
              </motion.span>
            ))}
          </h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 1.2, duration: 0.8 }}
            className="neo-subtitle"
          >
            YOU PLAY. YOUR TWIN WATCHES. YOUR TWIN LEARNS.
          </motion.p>
          <motion.button 
            whileHover={{ scale: 1.05, x: -4, y: -4, boxShadow: "8px 8px 0px #0a0610" }}
            whileTap={{ scale: 0.95, x: 0, y: 0, boxShadow: "0px 0px 0px #0a0610" }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.6, type: "spring", stiffness: 200 }}
            className="btn neo-btn-primary"
            onClick={() => {
              const hasToken = !!window.localStorage.getItem('mirrorbound.auth.token');
              setAppView(hasToken ? 'game' : 'auth');
            }}
          >
            ENTER THE MIRROR
          </motion.button>
        </motion.div>
      </section>

      {/* About Section */}
      <section className="landing-section about-section">
        <motion.div 
          initial={{ opacity: 0, x: -100, rotate: -5 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
          className="neo-card"
        >
          <h2 className="neo-card-title">THE AI COMPANION RPG</h2>
          <p className="neo-card-text">
            In Mirrorbound, you don't just fight enemies. You train your reflection. 
            Every slash, every dodge, and every tactical retreat is observed, mapped, and mirrored by your AI Twin.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 100, rotate: 5 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2, type: "spring", bounce: 0.4 }}
          className="neo-card neo-card-alt"
        >
          <h2 className="neo-card-title">DEFEAT YOURSELF</h2>
          <p className="neo-card-text">
            The ultimate boss is the ghost of your own playstyle. To win, you must become 
            unpredictable. Can you outsmart your own algorithms?
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.4, type: "spring", bounce: 0.4 }}
          className="neo-card"
          style={{ backgroundColor: 'var(--neo-yellow)', maxWidth: '800px', width: '100%', marginTop: '40px' }}
        >
          <h2 className="neo-card-title">EARLY ACCESS BETA</h2>
          <p className="neo-card-text">
            Welcome to the MirrorBound Closed Beta. As an early tester, your gameplay data directly influences 
            the evolution of the core AI models. Expect bugs, expect unbalanced encounters, and expect your Twin 
            to learn from your absolute worst mistakes. 
          </p>
        </motion.div>
      </section>
      
      {/* Footer / CTA Section */}
      <section className="landing-section cta-section">
        <motion.h2 
           initial={{ opacity: 0, scale: 0.5 }}
           whileInView={{ opacity: 1, scale: 1 }}
           viewport={{ once: true }}
           transition={{ type: "spring", bounce: 0.6 }}
           className="neo-cta-text"
        >
          READY TO SHATTER THE GLASS?
        </motion.h2>
        <motion.button 
          whileHover={{ scale: 1.05, x: -4, y: -4, boxShadow: "8px 8px 0px #0a0610" }}
          whileTap={{ scale: 0.95, x: 0, y: 0, boxShadow: "0px 0px 0px #0a0610" }}
          className="btn neo-btn-secondary"
          onClick={() => {
            const hasToken = !!window.localStorage.getItem('mirrorbound.auth.token');
            setAppView(hasToken ? 'game' : 'auth');
          }}
        >
          PLAY NOW
        </motion.button>
      </section>
    </div>
  );
}
