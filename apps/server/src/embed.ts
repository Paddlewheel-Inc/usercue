export const EMBED_SCRIPT = `(function () {
  var script = document.currentScript;
  if (!script || !script.src) return;
  var origin = new URL(script.src).origin;
  var data = script.dataset;
  var KINDS = ["feedback", "roadmap", "changelog"];
  var frames = [];

  function frameUrl(kind, board) {
    var url = origin + "/embed/" + kind;
    return board ? url + "?board=" + encodeURIComponent(board) : url;
  }

  function createFrame(kind, board) {
    var frame = document.createElement("iframe");
    frame.src = frameUrl(kind, board);
    frame.title = "Feedback";
    frame.loading = "lazy";
    frame.style.cssText = "border:0;width:100%;height:100%;display:block;background:transparent;color-scheme:normal";
    frames.push(frame);
    return frame;
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || !event.data || event.data.type !== "usercue:height") return;
    frames.forEach(function (frame) {
      if (frame.contentWindow === event.source && frame.dataset.auto === "true") {
        frame.style.height = Math.max(240, Number(event.data.height) || 0) + "px";
      }
    });
  });

  document.querySelectorAll("[data-usercue-embed]").forEach(function (target) {
    var kind = target.getAttribute("data-usercue-embed");
    if (KINDS.indexOf(kind) === -1) return;
    var frame = createFrame(kind, target.getAttribute("data-board") || "");
    frame.dataset.auto = "true";
    frame.style.height = "600px";
    target.appendChild(frame);
  });

  if (data.widget === "off") return;

  var side = data.position === "left" ? "left" : "right";
  var accent = /^#[0-9a-fA-F]{6}$/.test(data.color || "") ? data.color : "#ff2b87";

  var button = document.createElement("button");
  button.type = "button";
  button.textContent = data.label || "Feedback";
  button.setAttribute("aria-haspopup", "dialog");
  button.style.cssText =
    "position:fixed;bottom:20px;" + side + ":20px;z-index:2147483646;border:0;border-radius:999px;padding:12px 20px;" +
    "font:600 14px/1 ui-sans-serif,system-ui,sans-serif;color:#fff;cursor:pointer;background:" + accent +
    ";box-shadow:0 8px 24px rgba(0,0,0,.25)";

  var panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.hidden = true;
  panel.style.cssText =
    "position:fixed;bottom:76px;" + side + ":20px;z-index:2147483647;width:min(400px,calc(100vw - 40px));" +
    "height:min(620px,calc(100vh - 100px));border-radius:16px;overflow:hidden;background:#fff;" +
    "box-shadow:0 20px 60px rgba(0,0,0,.35)";

  var loaded = false;
  function toggle(open) {
    panel.hidden = !open;
    if (open && !loaded) {
      loaded = true;
      panel.appendChild(createFrame("feedback", data.board || ""));
    }
  }

  button.addEventListener("click", function () {
    toggle(panel.hidden);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") toggle(false);
  });

  document.body.appendChild(panel);
  document.body.appendChild(button);
})();
`;
