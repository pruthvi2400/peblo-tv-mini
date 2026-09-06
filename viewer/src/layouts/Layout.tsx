// eslint-disable-next-line react/react-in-jsx-scope
import React from 'react';
import { Navbar } from '../components/Navbar';

interface LayoutProps { children?: React.ReactNode; }

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">{children}</main>
    </div>
  );
}
