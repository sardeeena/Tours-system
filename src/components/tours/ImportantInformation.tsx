import React from 'react';
import { 
  Backpack, 
  AlertCircle, 
  MapPin, 
  ShieldCheck, 
  UserCheck, 
  HeartHandshake 
} from 'lucide-react';
import { Tour } from '../../types';

interface ImportantInformationProps {
  tour: Tour;
}

export const ImportantInformation: React.FC<ImportantInformationProps> = ({ tour }) => {
  return (
    <div className="space-y-6">
      <h3 className="font-display text-lg font-bold text-[#0E1B2A]">
        Important Information & Requirements
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        
        {/* What to bring */}
        {tour.whatToBring && tour.whatToBring.length > 0 && (
          <div className="bg-[#FAF8F5] border border-[#E8E3DA] rounded p-4">
            <div className="flex items-center space-x-2 mb-2.5 text-stone-900 font-bold">
              <Backpack className="w-4 h-4 text-[#0A6C74]" />
              <span>What to Bring</span>
            </div>
            <ul className="space-y-1.5 text-stone-600 pl-1">
              {tour.whatToBring.map((item, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-[#0A6C74] mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pickup Information */}
        <div className="bg-[#FAF8F5] border border-[#E8E3DA] rounded p-4">
          <div className="flex items-center space-x-2 mb-2.5 text-stone-900 font-bold">
            <MapPin className="w-4 h-4 text-[#0A6C74]" />
            <span>Pickup & Departure Details</span>
          </div>
          <p className="text-stone-600 leading-relaxed mb-2">
            {tour.pickupInfo}
          </p>
          <div className="bg-white/80 p-2 rounded border border-stone-200 text-[11px] text-stone-500">
            Please be in your hotel lobby 10 minutes prior to scheduled pickup time. Your driver or coordinator will call or WhatsApp upon arrival.
          </div>
        </div>

        {/* Cancellation Policy */}
        <div className="bg-[#FAF8F5] border border-[#E8E3DA] rounded p-4">
          <div className="flex items-center space-x-2 mb-2.5 text-stone-900 font-bold">
            <ShieldCheck className="w-4 h-4 text-[#0A6C74]" />
            <span>Cancellation & Refund Policy</span>
          </div>
          <p className="text-stone-600 leading-relaxed mb-2">
            {tour.cancellationPolicy}
          </p>
          <span className="text-[11px] text-emerald-700 font-semibold block">
            100% weather refund guarantee: If the Egyptian Coast Guard restricts maritime navigation due to heavy winds, trips are rescheduled or fully refunded immediately.
          </span>
        </div>

        {/* Health, Safety & Restrictions */}
        {((tour.importantInformation && tour.importantInformation.length > 0) || tour.ageRestrictions) && (
          <div className="bg-[#FAF8F5] border border-[#E8E3DA] rounded p-4">
            <div className="flex items-center space-x-2 mb-2.5 text-stone-900 font-bold">
              <AlertCircle className="w-4 h-4 text-[#0A6C74]" />
              <span>Guidelines & Safety</span>
            </div>
            <ul className="space-y-1.5 text-stone-600 pl-1">
              {(tour.importantInformation || []).map((info, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-stone-400 mr-2">•</span>
                  <span>{info}</span>
                </li>
              ))}
              {tour.ageRestrictions && (
                <li className="flex items-start font-semibold text-stone-800">
                  <span className="text-[#0A6C74] mr-2">•</span>
                  <span>{tour.ageRestrictions}</span>
                </li>
              )}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
};
