// === Initialize Product Grids ===
function initProductGrids() {
  renderProducts('trendingGrid', products.trending);
  renderProducts('handpickedGrid', products.bestsellers);
}
 
// === Hero Slider ===
function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  if (!slides.length) return;
  const dots = document.querySelectorAll('.hero-dot');
  const prevBtn = document.querySelector('.hero-prev');
  const nextBtn = document.querySelector('.hero-next');
  let current = 0;
  let autoSlide;
 
  function goToSlide(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = index;
    if (current < 0) current = slides.length - 1;
    if (current >= slides.length) current = 0;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }
 
  function startAuto() {
    autoSlide = setInterval(() => goToSlide(current + 1), 5000);
  }
 
  function resetAuto() {
    clearInterval(autoSlide);
    startAuto();
  }
 
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goToSlide(i); resetAuto(); });
  });
 
  prevBtn.addEventListener('click', () => { goToSlide(current - 1); resetAuto(); });
  nextBtn.addEventListener('click', () => { goToSlide(current + 1); resetAuto(); });
 
  startAuto();
}
 
// === Tab Functionality ===
function initTabs() {
  document.querySelectorAll('.tab-bar').forEach(tabBar => {
    const section = tabBar.closest('.section');
    const gridId = section.querySelector('.products-grid')?.id;
 
    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
 
        const tab = btn.dataset.tab;
        
        if (gridId === 'trendingGrid') {
          if (tab === 'all') {
            renderProducts('trendingGrid', products.trending);
          } else {
            const filtered = products.trending.filter(p => p.ageGroup === tab);
            renderProducts('trendingGrid', filtered.length > 0 ? filtered : products.trending);
          }
        } else if (gridId === 'handpickedGrid') {
          if (tab === 'bestsellers') renderProducts('handpickedGrid', products.bestsellers);
          else if (tab === 'newlaunches') renderProducts('handpickedGrid', products.newlaunches);
          else if (tab === 'bundles') renderProducts('handpickedGrid', products.bundles);
        }
      });
    });
  });
}
 
// === Testimonials Slider ===
function initTestimonialsSlider() {
  const track = document.querySelector('.testimonial-track');
  if (!track) return;
  const prevBtn = document.querySelector('.testimonial-prev');
  const nextBtn = document.querySelector('.testimonial-next');
  let position = 0;
  const cardWidth = 370; // card width + gap
 
  function slide(direction) {
    const maxScroll = track.scrollWidth - track.parentElement.offsetWidth;
    position += direction * cardWidth;
    position = Math.max(-maxScroll, Math.min(0, position));
    track.style.transform = `translateX(${position}px)`;
  }
 
  prevBtn.addEventListener('click', () => slide(1));
  nextBtn.addEventListener('click', () => slide(-1));
 
  // Touch/drag support
  let startX, startPos;
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startPos = position;
  });
 
  track.addEventListener('touchmove', (e) => {
    const diff = e.touches[0].clientX - startX;
    const maxScroll = track.scrollWidth - track.parentElement.offsetWidth;
    position = Math.max(-maxScroll, Math.min(0, startPos + diff));
    track.style.transform = `translateX(${position}px)`;
  });
}
 
