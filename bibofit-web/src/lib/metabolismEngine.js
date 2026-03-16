const SEX_MALE = 'male';
const SEX_FEMALE = 'female';

const ATHLETE_TYPES = ['Physique', 'Sport', 'Both'];
const FFM_METHODS = ['Skinfold', 'DXA', 'UWW', 'BIA'];

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const round2 = (value) => {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
};

export const normalizeSex = (sex) => {
  if (!sex) return null;
  const normalized = String(sex).trim().toLowerCase();

  if (['hombre', 'male', 'm', 'man'].includes(normalized)) return SEX_MALE;
  if (['mujer', 'female', 'f', 'woman'].includes(normalized)) return SEX_FEMALE;

  return null;
};

export const normalizeAthleteType = (athleteType) => {
  if (!athleteType) return null;
  const raw = String(athleteType).trim();
  const normalized = raw.toLowerCase();

  if (ATHLETE_TYPES.includes(raw)) return raw;

  if (['physique', 'enfoque en fisico', 'enfoque en físico', 'fisico', 'físico'].includes(normalized)) {
    return 'Physique';
  }

  if (['sport', 'enfoque en rendimiento', 'rendimiento'].includes(normalized)) {
    return 'Sport';
  }

  if (['both', 'ambos', 'mixto', 'fisico y rendimiento', 'físico y rendimiento'].includes(normalized)) {
    return 'Both';
  }

  return null;
};

export const normalizeFfmMethod = (ffmMethod) => {
  if (!ffmMethod) return null;
  const normalized = String(ffmMethod).trim();
  return FFM_METHODS.includes(normalized) ? normalized : null;
};

export const normalizeBooleanValue = (value) => {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === '') return null;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  return null;
};

/**
 * Replicates the spreadsheet logic (K10:K13) to derive body composition values from
 * whichever metric the user knows.
 */
export const deriveBodyComposition = ({
  weightKg,
  ffmPctInput,
  fmPctInput,
  ffmKgInput,
  fmKgInput
}) => {
  const weight = toNumberOrNull(weightKg);
  const ffmPctRaw = toNumberOrNull(ffmPctInput);
  const fmPctRaw = toNumberOrNull(fmPctInput);
  const ffmKgRaw = toNumberOrNull(ffmKgInput);
  const fmKgRaw = toNumberOrNull(fmKgInput);

  let ffmPct = null;

  if (ffmPctRaw !== null && ffmPctRaw !== 0) {
    ffmPct = ffmPctRaw;
  } else if (fmPctRaw !== null && fmPctRaw !== 0) {
    ffmPct = 100 - fmPctRaw;
  } else if (ffmKgRaw !== null && ffmKgRaw !== 0 && weight && weight > 0) {
    ffmPct = (ffmKgRaw * 100) / weight;
  } else if (fmKgRaw !== null && fmKgRaw !== 0 && weight && weight > 0) {
    ffmPct = ((weight - fmKgRaw) * 100) / weight;
  }

  let fmPct = null;
  if (fmPctRaw !== null && fmPctRaw !== 0) {
    fmPct = fmPctRaw;
  } else if (ffmPctRaw !== null && ffmPctRaw !== 0) {
    fmPct = 100 - ffmPctRaw;
  } else if (ffmKgRaw !== null && ffmKgRaw !== 0 && weight && weight > 0) {
    fmPct = ((weight - ffmKgRaw) * 100) / weight;
  } else if (fmKgRaw !== null && fmKgRaw !== 0 && weight && weight > 0) {
    fmPct = (fmKgRaw * 100) / weight;
  }

  let ffmKg = null;
  if (ffmKgRaw !== null && ffmKgRaw !== 0) {
    ffmKg = ffmKgRaw;
  } else if (ffmPctRaw !== null && ffmPctRaw !== 0 && weight && weight > 0) {
    ffmKg = (weight * ffmPctRaw) / 100;
  } else if (fmPctRaw !== null && fmPctRaw !== 0 && weight && weight > 0) {
    ffmKg = ((100 - fmPctRaw) * weight) / 100;
  } else if (fmKgRaw !== null && fmKgRaw !== 0 && weight && weight > 0) {
    ffmKg = weight - fmKgRaw;
  }

  let fmKg = null;
  if (fmKgRaw !== null && fmKgRaw !== 0) {
    fmKg = fmKgRaw;
  } else if (ffmPctRaw !== null && ffmPctRaw !== 0 && weight && weight > 0) {
    fmKg = ((100 - ffmPctRaw) * weight) / 100;
  } else if (fmPctRaw !== null && fmPctRaw !== 0 && weight && weight > 0) {
    fmKg = (weight * fmPctRaw) / 100;
  } else if (ffmKgRaw !== null && ffmKgRaw !== 0 && weight && weight > 0) {
    fmKg = weight - ffmKgRaw;
  }

  return {
    ffmPct: round2(ffmPct),
    fmPct: round2(fmPct),
    ffmKg: round2(ffmKg),
    fmKg: round2(fmKg)
  };
};

const withFinite = (value) => (isFiniteNumber(value) ? Number(value) : null);

export const calculateFormulaValues = ({
  sex,
  age,
  weightKg,
  heightCm,
  isAthlete,
  bodyComposition
}) => {
  const sexNormalized = normalizeSex(sex);
  const sexBinary = sexNormalized === SEX_MALE ? 1 : sexNormalized === SEX_FEMALE ? 0 : null;

  const ageNum = toNumberOrNull(age);
  const weight = toNumberOrNull(weightKg);
  const height = toNumberOrNull(heightCm);
  const ffmKg = toNumberOrNull(bodyComposition?.ffmKg);
  const fmKg = toNumberOrNull(bodyComposition?.fmKg);
  const isAthleteNormalized = normalizeBooleanValue(isAthlete);

  const formulas = {
    katch_mcardle_ffm: ffmKg !== null ? withFinite(370 + 21.6 * ffmKg) : null,
    cunningham_ffm: ffmKg !== null ? withFinite(500 + 22 * ffmKg) : null,
    owen_ffm:
      ffmKg !== null && sexNormalized
        ? withFinite(sexNormalized === SEX_FEMALE ? 19.7 * ffmKg + 334 : 22.3 * ffmKg + 290)
        : null,
    de_lorenzo_ffm: ffmKg !== null ? withFinite(19.7 * ffmKg + 413) : null,
    muller_ffm:
      ffmKg !== null && fmKg !== null && sexBinary !== null && ageNum !== null
        ? withFinite(239 * (0.05192 * ffmKg + 0.04036 * fmKg + 0.869 * sexBinary - 0.01181 * ageNum + 2.992))
        : null,
    ten_haaf_ffm: ffmKg !== null ? withFinite(0.239 * (95.272 * ffmKg + 2026.161)) : null,
    tinsley_ffm: ffmKg !== null ? withFinite(25.9 * ffmKg + 284) : null,

    owen_weight:
      weight !== null && sexNormalized
        ? withFinite(
            sexNormalized === SEX_FEMALE
              ? isAthleteNormalized === true
                ? 50.4 + 21.1 * weight
                : 795 + 7.18 * weight
              : 879 + 10.2 * weight
          )
        : null,
    mifflin_st_jeor_weight:
      weight !== null && height !== null && ageNum !== null && sexNormalized
        ? withFinite(10 * weight + 6.25 * height - 5 * ageNum + (sexNormalized === SEX_MALE ? 5 : -161))
        : null,
    de_lorenzo_weight:
      weight !== null && height !== null ? withFinite(-857 + 9 * weight + 11.7 * height) : null,
    muller_weight:
      weight !== null && ageNum !== null && sexBinary !== null
        ? withFinite(239 * (0.047 * weight + 1.009 * sexBinary - 0.01452 * ageNum + 3.21))
        : null,
    ten_haaf_weight:
      weight !== null && height !== null && ageNum !== null && sexBinary !== null
        ? withFinite(
            0.239 * (49.94 * weight + 2459.053 * (height / 100) - 34.014 * ageNum + 799.257 * sexBinary + 122.502)
          )
        : null,
    tinsley_weight: weight !== null ? withFinite(24.8 * weight + 10) : null
  };

  return formulas;
};

const FORMULA_LABELS = {
  katch_mcardle_ffm: 'Katch-McArdle (MLG)',
  cunningham_ffm: 'Cunningham (MLG)',
  owen_ffm: 'Owen (MLG)',
  de_lorenzo_ffm: 'De Lorenzo (MLG)',
  muller_ffm: 'Müller (MLG)',
  ten_haaf_ffm: 'ten Haaf (MLG)',
  tinsley_ffm: 'Tinsley (MLG)',
  owen_weight: 'Owen (Peso corporal)',
  mifflin_st_jeor_weight: 'Mifflin-St Jeor (Peso corporal)',
  de_lorenzo_weight: 'De Lorenzo (Peso corporal)',
  muller_weight: 'Müller (Peso corporal)',
  ten_haaf_weight: 'ten Haaf (Peso corporal)',
  tinsley_weight: 'Tinsley (Peso corporal)'
};

export const getFormulaLabel = (formulaKey) => FORMULA_LABELS[formulaKey] || formulaKey;

export const getRecommendedFormulaKeys = ({
  sex,
  knowsFfm,
  isAthlete,
  athleteType,
  ffmMethod
}) => {
  const sexNormalized = normalizeSex(sex);
  const knowsFfmNormalized = normalizeBooleanValue(knowsFfm);
  const isAthleteNormalized = normalizeBooleanValue(isAthlete);
  const athleteTypeNormalized = normalizeAthleteType(athleteType);
  const ffmMethodNormalized = normalizeFfmMethod(ffmMethod);

  if (knowsFfmNormalized === true) {
    if (isAthleteNormalized === true) {
      if (athleteTypeNormalized === 'Sport') {
        return ['ten_haaf_ffm'];
      }
      if (athleteTypeNormalized === 'Physique') {
        return ['cunningham_ffm', 'tinsley_ffm'];
      }
      if (athleteTypeNormalized === 'Both') {
        return ['cunningham_ffm', 'ten_haaf_ffm', 'tinsley_ffm'];
      }
      return [];
    }

    if (isAthleteNormalized === false) {
      if (ffmMethodNormalized === 'DXA') return ['katch_mcardle_ffm'];
      if (ffmMethodNormalized === 'Skinfold') return ['de_lorenzo_ffm'];
      if (ffmMethodNormalized === 'UWW') return ['owen_ffm'];
      if (ffmMethodNormalized === 'BIA') return ['muller_ffm'];
    }

    return [];
  }

  if (knowsFfmNormalized === false) {
    if (isAthleteNormalized === true) {
      if (athleteTypeNormalized === 'Sport') {
        if (sexNormalized === SEX_FEMALE) return ['ten_haaf_weight'];
        if (sexNormalized === SEX_MALE) return ['de_lorenzo_weight'];
      }

      if (athleteTypeNormalized === 'Physique') {
        if (sexNormalized === SEX_MALE) return ['tinsley_weight'];
        if (sexNormalized === SEX_FEMALE) return ['de_lorenzo_weight'];
      }

      if (athleteTypeNormalized === 'Both') {
        if (sexNormalized === SEX_MALE) return ['de_lorenzo_weight', 'tinsley_weight'];
        if (sexNormalized === SEX_FEMALE) return ['de_lorenzo_weight', 'ten_haaf_weight'];
      }

      return [];
    }

    if (isAthleteNormalized === false) {
      if (sexNormalized === SEX_FEMALE) return ['owen_weight'];
      if (sexNormalized === SEX_MALE) return ['mifflin_st_jeor_weight'];
    }

    return [];
  }

  return [];
};

const pickFirstAvailable = (keys, formulas) => keys.find((key) => isFiniteNumber(formulas[key])) || null;

export const selectGerFormula = ({ recommendedKeys, formulas }) => {
  const recommendedKey = pickFirstAvailable(recommendedKeys, formulas);
  if (recommendedKey) {
    return {
      formulaKey: recommendedKey,
      source: 'excel_recommended'
    };
  }

  if (isFiniteNumber(formulas.mifflin_st_jeor_weight)) {
    return {
      formulaKey: 'mifflin_st_jeor_weight',
      source: 'fallback_mifflin'
    };
  }

  const fallbackKey = Object.keys(formulas).find((key) => isFiniteNumber(formulas[key]));
  if (fallbackKey) {
    return {
      formulaKey: fallbackKey,
      source: 'fallback_available'
    };
  }

  return {
    formulaKey: null,
    source: 'insufficient_data'
  };
};

export const calculateGerFromProfile = ({ profile, age }) => {
  const bodyComposition = deriveBodyComposition({
    weightKg: profile?.current_weight_kg,
    ffmPctInput: profile?.ffm_pct,
    fmPctInput: profile?.fm_pct,
    ffmKgInput: profile?.ffm_kg,
    fmKgInput: profile?.fm_kg
  });

  const formulas = calculateFormulaValues({
    sex: profile?.sex,
    age,
    weightKg: profile?.current_weight_kg,
    heightCm: profile?.height_cm,
    isAthlete: profile?.is_athlete,
    bodyComposition
  });

  const recommendedKeys = getRecommendedFormulaKeys({
    sex: profile?.sex,
    knowsFfm: profile?.knows_ffm,
    isAthlete: profile?.is_athlete,
    athleteType: profile?.athlete_type,
    ffmMethod: profile?.ffm_method
  });

  const selection = selectGerFormula({ recommendedKeys, formulas });
  const athleteTypeNormalized = normalizeAthleteType(profile?.athlete_type);

  if (athleteTypeNormalized === 'Both' && recommendedKeys.length > 1) {
    const recommendedValues = recommendedKeys
      .map((key) => formulas[key])
      .filter((value) => isFiniteNumber(value))
      .map((value) => Number(value));

    if (recommendedValues.length > 1) {
      const average = recommendedValues.reduce((sum, value) => sum + value, 0) / recommendedValues.length;
      const gerRawAverage = withFinite(average);

      return {
        gerRaw: gerRawAverage,
        ger: isFiniteNumber(gerRawAverage) ? Math.round(gerRawAverage) : null,
        formulaKey: 'combined_athlete_average',
        formulaLabel: 'Promedio (físico y rendimiento)',
        formulaSource: 'combined_average',
        recommendedFormulaKeys: recommendedKeys,
        bodyComposition,
        formulas
      };
    }
  }

  const gerRaw = selection.formulaKey ? formulas[selection.formulaKey] : null;

  return {
    gerRaw,
    ger: isFiniteNumber(gerRaw) ? Math.round(gerRaw) : null,
    formulaKey: selection.formulaKey,
    formulaLabel: selection.formulaKey ? getFormulaLabel(selection.formulaKey) : null,
    formulaSource: selection.source,
    recommendedFormulaKeys: recommendedKeys,
    bodyComposition,
    formulas
  };
};

export const metabolismAdvancedOptions = {
  athleteTypes: ATHLETE_TYPES,
  ffmMethods: FFM_METHODS
};
