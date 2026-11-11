import { motion } from 'framer-motion';
import type { CompanyFuelData } from '@/lib/fuelStats';
import { FUEL_COLORS as COLORS } from '@/lib/fuelStats';

interface FuelCompanyTableProps {
  year: string;
  companyData: CompanyFuelData[];
  totalCost: number;
  totalLiters: number;
  totalVehicles: number;
  avgPerVehicle: number;
}

export function FuelCompanyTable({ year, companyData, totalCost, totalLiters, totalVehicles, avgPerVehicle }: FuelCompanyTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-6 border-b border-white/30">
        <h3 className="text-lg font-bold text-[#1d1d1f]">פירוט לפי חברה</h3>
        <p className="text-sm text-[#86868b]">{year}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-white/40">
            <tr className="border-b border-white/30">
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חברה</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">רכבים</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ליטרים</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">עלות כוללת</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ממוצע לרכב</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חלק מהסה"כ</th>
            </tr>
          </thead>
          <tbody>
            {companyData.map((company, i) => (
              <tr key={company.name} className="border-b border-black/[0.03] hover:bg-white/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-medium text-[#1d1d1f]">{company.shortName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#424245]">{company.vehicleCount}</td>
                <td className="px-4 py-3 text-[#424245]">{company.totalLiters.toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-[#1d1d1f]">₪{company.totalCost.toLocaleString()}</td>
                <td className="px-4 py-3 text-[#424245]">₪{company.avgCostPerVehicle.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-black/5 rounded-full max-w-[100px]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${totalCost > 0 ? (company.totalCost / totalCost) * 100 : 0}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-xs text-[#86868b]">
                      {totalCost > 0 ? Math.round((company.totalCost / totalCost) * 100) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {/* Total Row */}
            <tr className="bg-white/30 border-t-2 border-[#007AFF]/20">
              <td className="px-4 py-3 font-bold text-[#1d1d1f]">סה"כ</td>
              <td className="px-4 py-3 font-bold text-[#1d1d1f]">{totalVehicles}</td>
              <td className="px-4 py-3 font-bold text-[#1d1d1f]">{totalLiters.toLocaleString()}</td>
              <td className="px-4 py-3 font-bold text-[#007AFF]">₪{totalCost.toLocaleString()}</td>
              <td className="px-4 py-3 font-bold text-[#1d1d1f]">₪{avgPerVehicle.toLocaleString()}</td>
              <td className="px-4 py-3 font-bold text-[#1d1d1f]">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
