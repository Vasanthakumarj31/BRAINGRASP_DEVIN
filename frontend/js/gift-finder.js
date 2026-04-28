// === Gift Finder Wizard ===
function initGiftFinder() {
  const steps = document.querySelectorAll('.gift-finder-step');
  const progressFill = document.getElementById('giftProgressFill');
  const progressText = document.getElementById('giftProgressText');
  const resultDiv = document.getElementById('giftFinderResult');
  const resultGrid = document.getElementById('giftResultGrid');
  const restartBtn = document.getElementById('giftFinderRestart');
  
  if(!steps.length) return;

  let currentStep = 1;
  const totalSteps = steps.length;
  const answers = {};
  
  document.querySelectorAll('.gift-option').forEach(btn => {
    btn.addEventListener('click', function() {
      const parentStep = this.closest('.gift-finder-step');
      parentStep.querySelectorAll('.gift-option').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      answers[`step${parentStep.dataset.step}`] = this.dataset.value;
      
      setTimeout(() => {
        parentStep.classList.remove('active');
        if (currentStep < totalSteps) {
          currentStep++;
          document.querySelector(`.gift-finder-step[data-step="${currentStep}"]`).classList.add('active');
          updateProgress();
        } else {
          showGiftResults();
        }
      }, 400);
    });
  });

  restartBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    resultDiv.style.display = 'none';
    currentStep = 1;
    steps.forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.gift-option').forEach(b => b.classList.remove('selected'));
    document.querySelector('.gift-finder-step[data-step="1"]').classList.add('active');
    document.querySelector('.gift-finder-progress').style.display = 'block';
    updateProgress();
  });

  function updateProgress() {
    const percent = (currentStep / totalSteps) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Step ${currentStep} of ${totalSteps}`;
  }

  function showGiftResults() {
    const allProducts = [...products.trending, ...products.bestsellers, ...products.newlaunches, ...products.bundles];
    const ageChoice = answers.step2;
    const interest = answers.step3;
    const budget = answers.step4;

    let recommendations = allProducts.filter(product => {
      const ageMatch = !ageChoice || ageChoice === 'all' || product.ageGroup === ageChoice;
      const interestMatch = !interest || interest === 'all' ||
        (interest === 'science' && (product.category || '').toLowerCase().includes('learning')) ||
        (interest === 'art' && (product.category || '').toLowerCase().includes('arts')) ||
        (interest === 'puzzles' && (product.category || '').toLowerCase().includes('puzzle')) ||
        (interest === 'reading' && (product.name || '').toLowerCase().match(/word|book|flash|write/));

      const price = Number(product.price) || 0;
      const budgetMatch =
        !budget ||
        (budget === 'under500' && price < 500) ||
        (budget === '500-1000' && price >= 500 && price <= 1000) ||
        (budget === '1000-1500' && price >= 1000 && price <= 1500) ||
        (budget === 'above1500' && price > 1500);
      return ageMatch && interestMatch && budgetMatch;
    });

    if (recommendations.length < 3) {
      const fallback = allProducts.filter(p => !recommendations.some(r => r.id === p.id));
      recommendations = [...recommendations, ...fallback];
    }
    recommendations = recommendations.slice(0, 4);
    
    resultGrid.innerHTML = recommendations.map(createProductCard).join('');
    document.querySelector('.gift-finder-progress').style.display = 'none';
    resultDiv.style.display = 'block';
  }
}

