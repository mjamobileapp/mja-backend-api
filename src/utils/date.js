const JAKARTA_TIME_ZONE = "Asia/Jakarta";
const UTC_OFFSET = "+00:00";
const JAKARTA_UTC_OFFSET = "+07:00";

const parseUtcDate = (value) => {
  if (value instanceof Date) return value;

  if (typeof value !== "string") return new Date(value);

  const normalizedValue = value.includes("T") || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  return new Date(normalizedValue);
};

const getJakartaDateParts = (value) => {
  const date = parseUtcDate(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, part]));
};

const getTodayStringYYYYMMDD = (date = new Date()) => {
  const parts = getJakartaDateParts(date);
  return parts ? `${parts.year}${parts.month}${parts.day}` : "";
};

// Database DATETIME values are stored as UTC without a timezone suffix.
const getDatabaseTimestamp = (date = new Date()) => date.toISOString().slice(0, 19).replace("T", " ");

const formatTanggalWIB = (dateString) => {
  const date = getJakartaDateParts(dateString);
  if (!date) return "";
  const monthNames = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];

  const tanggal = date.day;
  const bulan = monthNames[Number(date.month) - 1];
  const tahun = date.year;

  return `${tanggal} ${bulan} ${tahun}`;
};

const formatTanggalJamWIB = (dateString) => {
  const date = getJakartaDateParts(dateString);
  if (!date) return "";
  const { day: tanggal, month: bulan, year: tahun, hour: jam, minute: menit } = date;

  return `${tanggal}/${bulan}/${tahun} ${jam}:${menit} WIB`;
};

const formatJamWIB = (dateString) => {
  const date = getJakartaDateParts(dateString);
  return date ? `${date.hour}:${date.minute} WIB` : "";
};

const getJakartaSqlDate = (columnName) => `DATE(CONVERT_TZ(${columnName}, '${UTC_OFFSET}', '${JAKARTA_UTC_OFFSET}'))`;

const getJakartaSqlTime = (columnName) => `DATE_FORMAT(CONVERT_TZ(${columnName}, '${UTC_OFFSET}', '${JAKARTA_UTC_OFFSET}'), '%H:%i')`;

const getDateFilterCondition = (columnName, filter = "") => {
  const normalizedFilter = String(filter || "").trim().toLowerCase();

  if (!normalizedFilter) {
    return "1=1";
  }

  const jakartaDate = getJakartaSqlDate(columnName);
  const jakartaToday = `DATE(CONVERT_TZ(UTC_TIMESTAMP(), '${UTC_OFFSET}', '${JAKARTA_UTC_OFFSET}'))`;

  switch (normalizedFilter) {
    case "kemarin":
    case "yesterday":
      return `${jakartaDate} = ${jakartaToday} - INTERVAL 1 DAY`;
    case "mingguan":
    case "minggu":
    case "weekly":
      return `YEARWEEK(${jakartaDate}, 1) = YEARWEEK(${jakartaToday}, 1)`;
    case "bulanan":
    case "bulan":
    case "monthly":
      return `YEAR(${jakartaDate}) = YEAR(${jakartaToday}) AND MONTH(${jakartaDate}) = MONTH(${jakartaToday})`;
    case "hari_ini":
    case "hari-ini":
    case "today":
    default:
      return `${jakartaDate} = ${jakartaToday}`;
  }
};

module.exports = {
  getDatabaseTimestamp,
  getTodayStringYYYYMMDD,
  formatTanggalWIB,
  formatTanggalJamWIB,
  formatJamWIB,
  getJakartaSqlDate,
  getJakartaSqlTime,
  getDateFilterCondition,
};
