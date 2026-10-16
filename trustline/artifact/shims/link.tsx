"use client";

import { forwardRef } from "react";
import { useRouterState } from "../router";

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean; replace?: boolean };

/** next/link replacement: navigates the in-memory router instead of the URL. */
const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, onClick, prefetch: _prefetch, replace, target: _target, ...rest }, ref) {
  const { navigate } = useRouterState();
  return (
    <a
      ref={ref}
      href={`#${href}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(href, { replace });
      }}
      {...rest}
    />
  );
});

export default Link;
