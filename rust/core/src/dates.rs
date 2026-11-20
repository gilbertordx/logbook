//! Date helpers. Original: `utils/dateUtils.js`.
//!
//! Days are identified by the string `DD/MM/YY` (e.g. `26/07/26`). The
//! JavaScript version used `new Date(...)`, which depends on the browser's
//! clock and has quirks (see `parse_dmy_day_number`). Here every function takes
//! plain numbers, so nothing reads the clock and tests are deterministic.

use chrono::{Datelike, NaiveDate};

/// `(2026, 7, 26)` -> `"26/07/26"`.
pub fn format_date_key(year: i32, month: u32, day: u32) -> String {
    format!("{:02}/{:02}/{:02}", day, month, year.rem_euclid(100))
}

/// JavaScript's `parseInt(text, 10)`: skips leading spaces, reads an optional
/// sign and as many digits as it can, ignores the rest ("12.7" -> 12). Returns
/// `None` where JavaScript returns `NaN`.
pub fn parse_int_prefix(text: &str) -> Option<i64> {
    let s = text.trim_start();
    let (negative, rest) = match s.strip_prefix('-') {
        Some(r) => (true, r),
        None => (false, s.strip_prefix('+').unwrap_or(s)),
    };
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    if digits.is_empty() {
        return None;
    }
    let n: i64 = digits.parse().ok()?;
    Some(if negative { -n } else { n })
}

/// Turn a `DD/MM/YY` key into "days since year 1" so keys can be compared.
///
/// Behaviour copied from the JS `parseDMY(...).getTime()`:
/// * wrong number of `/` parts -> the 1970 epoch (JS returned `new Date(0)`);
/// * a part that is not a number -> `None` (JS got `NaN`, and every comparison
///   with `NaN` is false, so such keys were simply ignored);
/// * out-of-range values roll over like JS (`31/02/26` is 3 March).
pub fn parse_dmy_day_number(key: &str) -> Option<i32> {
    let parts: Vec<&str> = key.split('/').collect();
    if parts.len() != 3 {
        return Some(NaiveDate::from_ymd_opt(1970, 1, 1)?.num_days_from_ce());
    }
    let day = parse_int_prefix(parts[0])?;
    let month = parse_int_prefix(parts[1])?;
    let year = 2000 + parse_int_prefix(parts[2])?;

    // Normalise the month first (month 13 = January next year), then add days.
    let month0 = month - 1;
    let year = year + month0.div_euclid(12);
    let month0 = month0.rem_euclid(12);
    let first = NaiveDate::from_ymd_opt(
        i32::try_from(year).ok()?,
        u32::try_from(month0 + 1).ok()?,
        1,
    )?;
    let date = first.checked_add_signed(chrono::Duration::days(day - 1))?;
    Some(date.num_days_from_ce())
}

/// Layout numbers for one month of the calendar (weeks start on Monday).
#[derive(Debug, PartialEq, Eq)]
pub struct MonthGrid {
    /// Greyed-out cells from the previous month before day 1.
    pub padding: u32,
    pub total_days: u32,
    /// Number of days in the previous month (to label the padding cells).
    pub prev_month_days: u32,
}

/// `month` is 1-12.
pub fn month_grid(year: i32, month: u32) -> MonthGrid {
    let first = NaiveDate::from_ymd_opt(year, month, 1).expect("valid month");
    let (prev_y, prev_m) = if month == 1 {
        (year - 1, 12)
    } else {
        (year, month - 1)
    };
    let days_in = |y: i32, m: u32| {
        let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
        NaiveDate::from_ymd_opt(ny, nm, 1)
            .unwrap()
            .pred_opt()
            .unwrap()
            .day()
    };
    MonthGrid {
        padding: first.weekday().num_days_from_monday(),
        total_days: days_in(year, month),
        prev_month_days: days_in(prev_y, prev_m),
    }
}

/// Step a `(year, month)` pair by `delta` months.
///
/// The JavaScript used `date.setMonth(month + 1)` on a date that still had
/// today's day-of-month, so on the 31st it skipped a month (31 Jan + 1 month =
/// 3 March). Tracking only year+month fixes that.
pub fn shift_month(year: i32, month: u32, delta: i32) -> (i32, u32) {
    let index = year * 12 + (month as i32 - 1) + delta;
    (index.div_euclid(12), (index.rem_euclid(12) + 1) as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_keys() {
        assert_eq!(format_date_key(2026, 7, 26), "26/07/26");
        assert_eq!(format_date_key(2005, 1, 3), "03/01/05");
    }

    #[test]
    fn parse_int_matches_javascript() {
        assert_eq!(parse_int_prefix("12.7"), Some(12));
        assert_eq!(parse_int_prefix("  42abc"), Some(42));
        assert_eq!(parse_int_prefix("-5"), Some(-5));
        assert_eq!(parse_int_prefix("abc"), None);
        assert_eq!(parse_int_prefix(""), None);
    }

    #[test]
    fn day_numbers_order_correctly() {
        let a = parse_dmy_day_number("12/07/26").unwrap();
        let b = parse_dmy_day_number("17/07/26").unwrap();
        let c = parse_dmy_day_number("01/01/27").unwrap();
        assert!(a < b && b < c);
        assert_eq!(
            parse_dmy_day_number("31/02/26"),
            parse_dmy_day_number("03/03/26")
        );
        assert_eq!(parse_dmy_day_number("x/y/z"), None);
    }

    #[test]
    fn month_grid_for_july_2026() {
        // 1 July 2026 is a Wednesday -> two padding cells on a Monday-first grid.
        assert_eq!(
            month_grid(2026, 7),
            MonthGrid {
                padding: 2,
                total_days: 31,
                prev_month_days: 30
            }
        );
        assert_eq!(month_grid(2026, 2).total_days, 28);
        assert_eq!(month_grid(2028, 2).total_days, 29);
    }

    #[test]
    fn month_shift_wraps_years_and_never_skips() {
        assert_eq!(shift_month(2026, 12, 1), (2027, 1));
        assert_eq!(shift_month(2026, 1, -1), (2025, 12));
        assert_eq!(shift_month(2026, 1, 1), (2026, 2)); // JS gave March from the 31st
    }
}
