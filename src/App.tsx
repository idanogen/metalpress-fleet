import { useState } from 'react';
import { Sidebar, type ViewType } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { ReportStatus } from '@/components/dashboard/ReportStatus';
import { AnomalyAlerts } from '@/components/dashboard/AnomalyAlerts';
import { FleetCharts } from '@/components/dashboard/FleetCharts';
import { FleetTable } from '@/components/dashboard/FleetTable';
import { DriverDetail } from '@/components/dashboard/DriverDetail';
import { FleetManagementPage } from '@/components/fleet-management/FleetManagementPage';
import { DriverRemindersPage } from '@/components/driver-reminders/DriverRemindersPage';
import { DriversDetailPage } from '@/components/drivers-detail/DriversDetailPage';
import { useFleetData } from '@/hooks/useFleetData';
import type { Vehicle } from '@/types/fleet';

function LoadingSkeleton() {
  return (
    <div className="lg:mr-[300px] pt-[80px] lg:pt-[110px] px-3 lg:px-5 pb-10 space-y-6 animate-pulse">
      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card h-[140px] rounded-[24px]" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card h-[400px] rounded-[24px]" />
        <div className="glass-card h-[400px] rounded-[24px]" />
      </div>
      <div className="glass-card h-[350px] rounded-[24px]" />
    </div>
  );
}

export default function App() {
  const fleet = useFleetData();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  return (
    <div className="min-h-screen text-[#1d1d1f]" dir="rtl">
      {/* Floating Sidebar */}
      <Sidebar currentView={currentView} onNavigate={setCurrentView} unreportedCount={fleet.unreportedVehicles.length} />

      {/* Floating Header */}
      <Header
        selectedYear={fleet.selectedYear}
        selectedMonth={fleet.selectedMonth}
        onYearChange={fleet.setSelectedYear}
        onMonthChange={fleet.setSelectedMonth}
        lastUpdated={fleet.lastUpdated}
        isLoading={fleet.isLoading}
      />

      {/* Loading State */}
      {fleet.isLoading && !fleet.vehicles.length ? (
        <LoadingSkeleton />
      ) : (
        /* Main Content — offset for sidebar */
        <main className="lg:mr-[300px] pt-[80px] lg:pt-[110px] px-3 lg:px-5 pb-10 space-y-6">
          {currentView === 'dashboard' && (
            <>
              {/* KPI Cards */}
              <KpiCards stats={fleet.stats} />

              {/* Report Status + Anomalies */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ReportStatus
                  stats={fleet.stats}
                  reportedVehicles={fleet.reportedVehicles}
                  unreportedVehicles={fleet.unreportedVehicles}
                  selectedYear={fleet.selectedYear}
                  selectedMonth={fleet.selectedMonth}
                  onSelectVehicle={setSelectedVehicle}
                />
                <AnomalyAlerts
                  anomalies={fleet.anomalies}
                  onSelectVehicle={setSelectedVehicle}
                />
              </div>

              {/* Charts */}
              <FleetCharts
                vehicles={fleet.vehicles}
                selectedYear={fleet.selectedYear}
                selectedMonth={fleet.selectedMonth}
              />

              {/* Fleet Table */}
              <FleetTable
                vehicles={fleet.vehicles}
                selectedYear={fleet.selectedYear}
                selectedMonth={fleet.selectedMonth}
                onSelectVehicle={setSelectedVehicle}
              />
            </>
          )}

          {currentView === 'fleet-management' && (
            <FleetManagementPage
              vehicles={fleet.vehicles}
              onSelectVehicle={setSelectedVehicle}
            />
          )}

          {currentView === 'driver-reminders' && (
            <DriverRemindersPage
              vehicles={fleet.vehicles}
              selectedYear={fleet.selectedYear}
              selectedMonth={fleet.selectedMonth}
            />
          )}

          {currentView === 'drivers-detail' && (
            <DriversDetailPage vehicles={fleet.vehicles} />
          )}
        </main>
      )}

      {/* Driver Detail Drawer */}
      {selectedVehicle && (
        <DriverDetail
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}
    </div>
  );
}
