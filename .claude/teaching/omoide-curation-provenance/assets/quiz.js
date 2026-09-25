// Minimal retrieval-practice quiz. Each fieldset has data-answer="<value>"; radios carry values.
// Feedback is immediate. No answer-length hints: authors keep every option the same length.
(() => {
  function grade(fs) {
    const want = fs.getAttribute("data-answer");
    const picked = fs.querySelector("input[type=radio]:checked");
    const fb = fs.querySelector(".fb");
    if (!picked) {
      fb.textContent = "Pick one first.";
      fb.className = "fb";
      return;
    }
    const ok = picked.value === want;
    fb.textContent = ok
      ? `Correct. ${fs.getAttribute("data-why") || ""}`
      : `Not yet. ${fs.getAttribute("data-hint") || "Re-read the section above and try again."}`;
    fb.className = `fb ${ok ? "ok" : "no"}`;
    try {
      localStorage.setItem(`quiz:${location.pathname}:${fs.id}`, ok ? "1" : "0");
    } catch (e) {}
  }
  document.querySelectorAll(".quiz fieldset").forEach((fs) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Check";
    b.addEventListener("click", () => {
      grade(fs);
    });
    const fb = document.createElement("div");
    fb.className = "fb";
    fs.appendChild(b);
    fs.appendChild(fb);
  });
})();
