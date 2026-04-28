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
  
  document.querySelectorAll('.gift-option').forEach(btn => {
    btn.addEventListener('click', function() {
      const parentStep = this.closest('.gift-finder-step');
      parentStep.querySelectorAll('.gift-option').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      
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
    const shuffled = [...products.trending, ...products.bestsellers].sort(() => 0.5 - Math.random());
    const recommendations = shuffled.slice(0, 3);
    
    resultGrid.innerHTML = recommendations.map(createProductCard).join('');
    document.querySelector('.gift-finder-progress').style.display = 'none';
    resultDiv.style.display = 'block';
  }
}

