// Shared quiz component: any fieldset.q with radio inputs, one carrying data-correct.
// Shows immediate feedback in the sibling .result element.
document.querySelectorAll(".quiz fieldset.q").forEach((q) => {
  const result = q.querySelector(".result");
  q.querySelectorAll("input[type=radio]").forEach((input) => {
    input.addEventListener("change", () => {
      const right = input.hasAttribute("data-correct");
      result.textContent = right ? "✓ Correct." : "✗ Not quite — try again.";
      result.className = "result " + (right ? "right" : "wrong");
    });
  });
});
