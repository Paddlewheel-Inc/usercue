import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WORKFLOW_ICONS, type WorkflowStatus } from "@usercue/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusIcon, WorkflowGlyph } from "./WorkflowIcon";

test.each(WORKFLOW_ICONS)("saved %s icon matches its picker preview", (icon) => {
  const client = new QueryClient();
  const status: WorkflowStatus = {
    id: "test",
    name: "Test",
    icon,
    color: "#a78bfa",
    category: "in_progress",
  };
  client.setQueryData(["workflow"], [status]);
  const displayed = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(StatusIcon, { status: "test", size: 18 }),
    ),
  );
  const preview = renderToStaticMarkup(
    createElement(WorkflowGlyph, { icon, color: status.color, size: 18 }),
  );
  expect(displayed).toBe(preview);
  client.clear();
});
