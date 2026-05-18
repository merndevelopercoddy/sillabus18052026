document.addEventListener("DOMContentLoaded", function () {
  const manbaSelect = document.getElementById("manba_turi");
  const kitobFields = document.querySelectorAll(".kitob-field");
  const internetFields = document.querySelectorAll(".internet-field");

  if (!manbaSelect) return;

  function toggleFields() {
    const value = manbaSelect.value;

    if (value === "internet") {
      internetFields.forEach((el) => {
        el.style.display = "block";
      });

      kitobFields.forEach((el) => {
        el.style.display = "none";
      });
    } else {
      internetFields.forEach((el) => {
        el.style.display = "none";
      });

      kitobFields.forEach((el) => {
        el.style.display = "block";
      });
    }
  }

  manbaSelect.addEventListener("change", toggleFields);
  toggleFields();
});