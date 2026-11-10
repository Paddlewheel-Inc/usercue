import { describe, expect, test } from "bun:test";
import { markdownToHtml } from "./markdown";

const options = { headings: true, sections: true };

describe("changelog markdown", () => {
  test("section headings tag the bullets beneath them", () => {
    const html = markdownToHtml(
      "## New\n- Dark mode\n- **Bold** tweaks\n\n## Fixed\n- Login loop",
      options,
    );
    expect(html).toContain('<span data-section="New" contenteditable="false">New</span> Dark mode');
    expect(html).toContain("<b>Bold</b> tweaks");
    expect(html).toContain(
      '<span data-section="Fixed" contenteditable="false">Fixed</span> Login loop',
    );
    expect(html).not.toContain("<h2>");
  });

  test("bracket tags work inline", () => {
    const html = markdownToHtml("[Removed] Legacy export\n- [Changed] Faster search", options);
    expect(html).toContain('data-section="Removed"');
    expect(html).toContain('data-section="Changed"');
  });

  test("subheadings keep the section and blank lines add spacing", () => {
    const html = markdownToHtml(
      "## New\n### Triage\n- One\n\n- Two\n\n\n### More\n- Three",
      options,
    );
    expect(html.match(/data-section="New"/g)?.length).toBe(3);
    expect(html).toContain("<h3>Triage</h3>");
    expect(html.match(/<div><br><\/div>/g)?.length).toBe(2);
  });

  test("other headings and lists render normally", () => {
    const html = markdownToHtml("## Highlights\n- one\n- two", options);
    expect(html).toBe("<h2>Highlights</h2><ul><li>one</li><li>two</li></ul>");
  });

  test("unsafe markup is neutralised", () => {
    const html = markdownToHtml("<script>alert(1)</script> [x](javascript:alert(1))", options);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<a");
  });
});
