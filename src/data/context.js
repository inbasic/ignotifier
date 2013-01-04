var ul = document.getElementById("emails");

function add (label, count, value) {
  var li = document.createElement("li");
  var a = document.createElement("a");
  a.setAttribute("value", value);
  a.textContent = label;
  var font = document.createElement("font");
  font.textContent = " (" +count + ")";
  li.appendChild(a);
  a.appendChild(font);
  ul.appendChild(li);
}
function clear () {
  while (ul.firstChild) {
    ul.removeChild(ul.firstChild);
  }
}

self.port.on("list", function(list) {
  clear();
  list.forEach(function (obj, index) {
    add(obj.account, obj.count, obj.link)
  });
});

ul.addEventListener("click", function (e) {
  self.port.emit('click', e.originalTarget.getAttribute("value"));
})