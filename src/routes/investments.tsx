import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/investments")({
  component: InvestmentsLayout,
});

function InvestmentsLayout() {
  return <Outlet />;
}