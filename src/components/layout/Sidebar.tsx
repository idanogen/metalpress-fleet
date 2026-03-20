import { LayoutDashboard, Truck, Settings, ShieldCheck, Users, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export type ViewType = 'dashboard' | 'fleet-management' | 'driver-reminders' | 'drivers-detail' | 'settings';

// WhatsApp icon as inline SVG for accurate branding
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

interface NavItemDef {
  icon: typeof LayoutDashboard | typeof WhatsAppIcon;
  label: string;
  view: ViewType;
  customIcon?: boolean;
}

const navItems: NavItemDef[] = [
  { icon: LayoutDashboard, label: 'דאשבורד', view: 'dashboard' },
  { icon: Truck, label: 'ניהול צי', view: 'fleet-management' },
  { icon: WhatsAppIcon, label: 'תזכורת לנהגים', view: 'driver-reminders', customIcon: true },
  { icon: Users, label: 'נהגים מפורט', view: 'drivers-detail' },
  { icon: Settings, label: 'הגדרות', view: 'settings' },
];

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  unreportedCount?: number;
}

export function Sidebar({ currentView, onNavigate, unreportedCount }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = () => { if (mq.matches) setMobileOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleNavigate = (view: ViewType) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 mb-10">
        <ShieldCheck className="w-6 h-6 text-[#007AFF]" />
        <span className="text-2xl font-extrabold text-[#007AFF]">MetalPress</span>
        {/* Close button — mobile only */}
        <button onClick={() => setMobileOpen(false)} className="mr-auto lg:hidden p-1 rounded-xl hover:bg-black/5">
          <X className="w-5 h-5 text-[#86868b]" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;
          const isDisabled = item.view === 'settings';
          const isWhatsApp = item.view === 'driver-reminders';
          return (
            <button
              key={item.view}
              onClick={() => !isDisabled && handleNavigate(item.view)}
              disabled={isDisabled}
              className={`flex items-center gap-3 px-[18px] py-3 rounded-[14px] cursor-pointer transition-all duration-200 font-medium text-right w-full ${
                isActive
                  ? isWhatsApp
                    ? 'bg-[#25D366]/10 text-[#25D366]'
                    : 'bg-[rgba(0,122,255,0.1)] text-[#007AFF]'
                  : isDisabled
                    ? 'text-[#c7c7cc] cursor-not-allowed'
                    : 'text-[#424245] hover:bg-white/40'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {isWhatsApp && unreportedCount != null && unreportedCount > 0 && (
                <span className="mr-auto bg-[#ff3b30] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {unreportedCount}
                </span>
              )}
              {isDisabled && <span className="mr-auto text-[10px] text-[#c7c7cc]">בקרוב</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto px-4">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/30">
          <div className="w-9 h-9 rounded-full bg-[#007AFF]/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1d1d1f]">מנהל צי</p>
            <p className="text-xs text-[#86868b]">MetalPress</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 right-4 z-50 lg:hidden w-11 h-11 rounded-2xl bg-white/60 backdrop-blur-[20px] border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.06)] flex items-center justify-center"
      >
        <Menu className="w-5 h-5 text-[#1d1d1f]" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[59] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible, mobile: drawer */}
      <aside className={`
        fixed top-5 right-5 bottom-5 w-[260px]
        bg-white/40 backdrop-blur-[25px] border border-white/60 rounded-[30px]
        p-[30px_15px] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.03)] z-[60]
        transition-transform duration-300 ease-out
        lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : 'translate-x-[120%]'}
      `}>
        {sidebarContent}
      </aside>
    </>
  );
}
