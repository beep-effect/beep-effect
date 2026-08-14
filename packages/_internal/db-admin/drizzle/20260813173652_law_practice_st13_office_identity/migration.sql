CREATE FUNCTION law_practice_is_wipo_st13_office_code(office_code text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT
RETURN office_code IN (
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AP', 'AR', 'AT', 'AU', 'AW', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BM', 'BN', 'BO', 'BQ', 'BR',
  'BS', 'BT', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK',
  'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM',
  'DO', 'DZ', 'EA', 'EC', 'EE', 'EG', 'EH', 'EM', 'EP', 'ER', 'ES', 'ET', 'EU', 'FI',
  'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GC', 'GD', 'GE', 'GG', 'GH', 'GI', 'GL',
  'GM', 'GN', 'GQ', 'GR', 'GS', 'GT', 'GW', 'GY', 'HK', 'HN', 'HR', 'HT', 'HU', 'IB',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE',
  'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI',
  'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OA', 'OM', 'PA', 'PE',
  'PG', 'PH', 'PK', 'PL', 'PT', 'PW', 'PY', 'QA', 'QZ', 'RO', 'RS', 'RU', 'RW', 'SA',
  'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TG', 'TH', 'TJ', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VN',
  'VU', 'WO', 'WS', 'XN', 'XU', 'XV', 'YE', 'ZA', 'ZM', 'ZW'
);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM law_practice_candor_disposition
    WHERE citing_application ->> 'kind' = 'WipoSt13'
      AND (
        NOT citing_application ? 'officeCode'
        OR jsonb_typeof(citing_application -> 'officeCode') <> 'string'
        OR NOT law_practice_is_wipo_st13_office_code(citing_application ->> 'officeCode')
      )
    UNION ALL
    SELECT 1 FROM law_practice_ids_submission_fact
    WHERE citing_application ->> 'kind' = 'WipoSt13'
      AND (
        NOT citing_application ? 'officeCode'
        OR jsonb_typeof(citing_application -> 'officeCode') <> 'string'
        OR NOT law_practice_is_wipo_st13_office_code(citing_application ->> 'officeCode')
      )
    UNION ALL
    SELECT 1 FROM law_practice_patent_citation_event
    WHERE citing_application ->> 'kind' = 'WipoSt13'
      AND (
        NOT citing_application ? 'officeCode'
        OR jsonb_typeof(citing_application -> 'officeCode') <> 'string'
        OR NOT law_practice_is_wipo_st13_office_code(citing_application ->> 'officeCode')
      )
  ) THEN
    RAISE EXCEPTION 'legacy WipoSt13 candor identity requires explicit office resolution before migration';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE law_practice_candor_disposition
  ADD CONSTRAINT law_practice_candor_disposition_st13_office_check
  CHECK (
    citing_application ->> 'kind' <> 'WipoSt13'
    OR (
      citing_application ? 'officeCode'
      AND jsonb_typeof(citing_application -> 'officeCode') = 'string'
      AND law_practice_is_wipo_st13_office_code(citing_application ->> 'officeCode')
    )
  );
--> statement-breakpoint
ALTER TABLE law_practice_ids_submission_fact
  ADD CONSTRAINT law_practice_ids_submission_fact_st13_office_check
  CHECK (
    citing_application ->> 'kind' <> 'WipoSt13'
    OR (
      citing_application ? 'officeCode'
      AND jsonb_typeof(citing_application -> 'officeCode') = 'string'
      AND law_practice_is_wipo_st13_office_code(citing_application ->> 'officeCode')
    )
  );
--> statement-breakpoint
ALTER TABLE law_practice_patent_citation_event
  ADD CONSTRAINT law_practice_patent_citation_event_st13_office_check
  CHECK (
    citing_application ->> 'kind' <> 'WipoSt13'
    OR (
      citing_application ? 'officeCode'
      AND jsonb_typeof(citing_application -> 'officeCode') = 'string'
      AND law_practice_is_wipo_st13_office_code(citing_application ->> 'officeCode')
    )
  );
