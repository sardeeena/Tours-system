import React from 'react';

const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY
MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN
PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN
SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`.trim().split(/\\s+/);

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
const flagFor = (code: string) => String.fromCodePoint(...Array.from(code.toUpperCase()).map((char) => 127397 + char.charCodeAt(0)));
const COUNTRIES = COUNTRY_CODES
  .map((code) => ({ code, name: displayNames.of(code) || code, flag: flagFor(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

interface CountrySelectProps {
  id: string;
  value: string;
  onChange: (country: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  id, value, onChange, required = false, className, placeholder = 'Choose your country',
}) => (
  <select
    id={id}
    value={value}
    required={required}
    onChange={(event) => onChange(event.target.value)}
    autoComplete="country-name"
    className={className || 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'}
  >
    <option value="">{placeholder}</option>
    {COUNTRIES.map((country) => (
      <option key={country.code} value={country.name}>{country.flag} {country.name}</option>
    ))}
  </select>
);
