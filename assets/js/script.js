// ===== Client logos marquee =====
const clientLogoTrack = document.getElementById("clientLogoTrack");
if (clientLogoTrack) {
  const clientLogos = [
    ["/assets/img/clients/client-motor-master.png", "Motor Master"],
    ["/assets/img/clients/client-ferragista-maike.png", "Ferragista Maike"],
    ["/assets/img/clients/client-parafusos.png", "Parafusos Máquinas e Ferramentas"],
    ["/assets/img/clients/client-real-ferragista.png", "Real Ferragista"],
    ["/assets/img/clients/client-izf-ismaik.png", "iZF Ismaik Ferragista"],
    ["/assets/img/clients/client-sp-ferragista.png", "S&P Ferragista"],
    ["/assets/img/clients/client-pracasa-ferragista.png", "Pra Casa Ferragista"],
    ["/assets/img/clients/client-bastos-materiais.png", "Bastos Materiais"],
    ["/assets/img/clients/client-mix-limpeza.png?v=2", "Mix Limpeza"],
  ];
  const tiles = clientLogos.map(([src, alt]) => `<div class="logo-tile"><img src="${src}" alt="${alt}"></div>`).join("");
  clientLogoTrack.innerHTML = tiles + tiles;
}

// ===== TRACTO ticker =====
const tickerTrack = document.getElementById("tickerTrack");
if (tickerTrack) {
  const items = new Array(24).fill("TRACTO").map(t => `<span>${t}</span><span>•</span>`).join("");
  tickerTrack.innerHTML = items + items;
}

// ===== Objections accordion =====
const obterItems = document.querySelectorAll(".obter-item");
obterItems.forEach(item => {
  item.addEventListener("click", () => {
    const wasActive = item.classList.contains("is-active");
    obterItems.forEach(i => i.classList.remove("is-active"));
    if (!wasActive) item.classList.add("is-active");
  });
});

// ===== FAQ accordion =====
document.querySelectorAll(".faq-q").forEach(btn => {
  btn.addEventListener("click", () => {
    const item = btn.closest(".faq-item");
    const wasOpen = item.classList.contains("is-open");
    document.querySelectorAll(".faq-item").forEach(i => i.classList.remove("is-open"));
    if (!wasOpen) item.classList.add("is-open");
  });
});

// ===== Scroll to hero form =====
document.querySelectorAll("[data-scroll-form]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelector(".hero-form-card").scrollIntoView({ behavior: "smooth", block: "center" });
    const firstField = document.querySelector(".js-lead-form input");
    if (firstField) firstField.focus({ preventScroll: true });
  });
});

// ===== Lead capture form =====
// Configure this once you have your Make.com (or similar) webhook URL.
// Every form on every LP (home, assessoria-marketing, marketplace) posts here.
const LEAD_WEBHOOK_URL = "";

document.querySelectorAll("form.js-lead-form").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type=submit]");
    const originalLabel = submitBtn ? submitBtn.textContent : "";

    if (!LEAD_WEBHOOK_URL) {
      alert("Formulário de demonstração. Configure LEAD_WEBHOOK_URL em assets/js/script.js pra conectar ao CRM.");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Enviando..."; }

    try {
      await fetch(LEAD_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      form.innerHTML = '<p class="lead-success">Recebemos seus dados! Em breve alguém da Tracto chama você no WhatsApp.</p>';
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
      alert("Não conseguimos enviar agora. Tenta de novo em instantes ou chama a gente direto no WhatsApp.");
    }
  });
});

// ===== Fade-in on scroll =====
const revealTargets = document.querySelectorAll(".desafio-card, .benefit-card, .method-card, .obter-item, .faq-item, .case-card, .testi-card, .testi-video-wrap, .result-card, .side-pill, .team-card, .graph-card, .graph-wrap .solution-copy, .market-news-copy, .market-news-img, .market-callout, .compare-card, .diag-card, .cta-final");
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = 1;
      entry.target.style.transform = "translateY(0)";
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealTargets.forEach(el => {
  el.style.opacity = 0;
  el.style.transform = "translateY(16px)";
  el.style.transition = "opacity .5s ease, transform .5s ease";
  revealObserver.observe(el);
});
