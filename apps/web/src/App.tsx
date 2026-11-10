import { type ReactNode, useEffect } from "react";
import { Redirect, Route, Switch } from "wouter";
import { PublicLayout } from "./components/PublicLayout";
import { applyAccent } from "./lib/accent";
import { useMe } from "./lib/queries";
import { applySite } from "./lib/site";
import { useOnline } from "./lib/useOnline";
import { Account } from "./pages/Account";
import { Admin } from "./pages/Admin";
import { AuthPage } from "./pages/Auth";
import { Changelog } from "./pages/Changelog";
import { Dashboard } from "./pages/Dashboard";
import { Embed } from "./pages/Embed";
import { Feedback } from "./pages/Feedback";
import { JoinPage } from "./pages/Join";
import { PostPage } from "./pages/Post";
import { Roadmap } from "./pages/Roadmap";
import { Settings } from "./pages/Settings";

const Public = ({ children, wide }: { children: ReactNode; wide?: boolean }) => (
  <PublicLayout wide={wide}>{children}</PublicLayout>
);

export function App() {
  const { data: me, isLoading, isError, refetch } = useMe();
  const online = useOnline();
  useEffect(() => {
    if (me?.accent) applyAccent(me.accent);
  }, [me?.accent]);
  useEffect(() => {
    if (me?.siteName && me.faviconUrl) applySite(me.siteName, me.faviconUrl);
  }, [me?.siteName, me?.faviconUrl]);
  if (isLoading) {
    return <div className="min-h-dvh bg-bg" aria-busy="true" />;
  }
  if (isError || !me) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg px-4 text-center">
        <p className="text-[13px] font-medium">
          {online ? "Couldn&apos;t reach the server" : "You&apos;re offline"}
        </p>
        <p className="text-muted">
          {online
            ? "Make sure the API is running, then try again."
            : "Reconnect to the internet, then try again."}
        </p>
        <button type="button" className="btn-ghost mt-2" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (me.needsSetup) {
    return (
      <Switch>
        <Route path="/setup">
          <AuthPage mode="setup" />
        </Route>
        <Route>
          <Redirect to="/setup" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/embed/:kind">{(params) => <Embed kind={params.kind} />}</Route>
      <Route path="/login">
        {me.user?.staff ? (
          <Redirect to="/admin" />
        ) : me.user ? (
          <Redirect to="/" />
        ) : (
          <AuthPage mode="login" />
        )}
      </Route>
      <Route path="/signin">{me.user ? <Redirect to="/" /> : <AuthPage mode="signin" />}</Route>
      <Route path="/setup">
        <Redirect to={me.user?.staff ? "/admin" : "/login"} />
      </Route>
      <Route path="/join/:token">
        {me.user?.staff ? <Redirect to="/admin" /> : me.user ? <Redirect to="/" /> : <JoinPage />}
      </Route>
      <Route path="/account">
        {me.user ? (
          <Public>
            <Account />
          </Public>
        ) : (
          <Redirect to="/signin" />
        )}
      </Route>
      <Route path="/admin/settings/:tab?">
        {me.user?.staff ? <Settings /> : me.user ? <Redirect to="/" /> : <Redirect to="/login" />}
      </Route>
      <Route path="/admin/requests/:id?">
        {me.user?.staff ? <Admin /> : me.user ? <Redirect to="/" /> : <Redirect to="/login" />}
      </Route>
      <Route path="/admin">
        {me.user?.staff ? <Dashboard /> : me.user ? <Redirect to="/" /> : <Redirect to="/login" />}
      </Route>

      <Route path="/changelog/:id">
        <Public wide>
          <Changelog />
        </Public>
      </Route>
      <Route path="/changelog">
        <Public wide>
          <Changelog />
        </Public>
      </Route>
      <Route path="/roadmap">
        <Public wide>
          <Roadmap />
        </Public>
      </Route>
      <Route path="/post/:id">
        <Public wide>
          <PostPage />
        </Public>
      </Route>
      <Route path="/board/:board">
        <Public>
          <Feedback />
        </Public>
      </Route>
      <Route path="/">
        <Public>
          <Feedback />
        </Public>
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}
