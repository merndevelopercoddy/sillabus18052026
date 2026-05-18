document.addEventListener("DOMContentLoaded", function () {
    const limitSelect = document.getElementById("limitSelect");
    if (!limitSelect) return;
  
    limitSelect.addEventListener("change", function () {
      const limit = this.value;
      const url = new URL(window.location.href);
  
      // limit o‘zgarganda 1-sahifadan boshlaymiz
      url.searchParams.set("limit", limit);
      url.searchParams.set("page", 1);
  
      // URL’ni yangilab qayta yuklaymiz
      window.location.href = url.toString();
    });
  });  