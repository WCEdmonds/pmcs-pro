import { describe, it, expect } from 'vitest'
import { describeAction, formatAuditDetails, humanizeKey, rawDetails } from '../lib/audit'

describe('audit details formatting', () => {
  it('humanizes keys and actions', () => {
    expect(humanizeKey('notification_emails')).toBe('Notification emails')
    expect(humanizeKey('uic')).toBe('UIC')
    expect(humanizeKey('targetUserId')).toBe('Target user ID')
    expect(describeAction('user.reset_pin')).toBe('User: reset PIN')
    expect(describeAction('unit_settings.update')).toBe('Unit settings: update')
    expect(describeAction('login')).toBe('Login')
    expect(describeAction('admin.pin_reset')).toBe('Admin: PIN reset')
    expect(describeAction('admin.role_change')).toBe('Admin: role change')
  })

  it('renders from/to objects and paired old_/new_ keys as one change line', () => {
    expect(formatAuditDetails({ unit: { from: 'WXYZA0', to: 'WXYZB1' } })).toEqual([{ label: 'Unit', value: 'WXYZA0 → WXYZB1' }])
    expect(formatAuditDetails({ old_role: 'member', new_role: 'admin', reason: null })).toEqual([
      { label: 'Role', value: 'member → admin' },
      { label: 'Reason', value: '(none)' },
    ])
  })

  it('parses JSON-string details, joins arrays and formats booleans', () => {
    const lines = formatAuditDetails('{"notification_emails":["a@x.mil","b@x.mil"],"part_needed":true}')
    expect(lines).toEqual([
      { label: 'Notification emails', value: 'a@x.mil, b@x.mil' },
      { label: 'Part needed', value: 'yes' },
    ])
  })

  it('never shows secrets such as a temporary PIN or token', () => {
    const lines = formatAuditDetails({ temp_pin: '123456', token: 'abc', must_change_pin: 1 })
    expect(lines).toEqual([
      { label: 'Temp PIN', value: '(hidden)' },
      { label: 'Token', value: '(hidden)' },
      { label: 'Must change PIN', value: '1' },
    ])
  })

  it('handles empty and non-object details', () => {
    expect(formatAuditDetails(null)).toEqual([])
    expect(formatAuditDetails('')).toEqual([])
    expect(formatAuditDetails('plain text')).toEqual([{ label: 'Details', value: 'plain text' }])
    expect(formatAuditDetails(['WXYZA0'])).toEqual([{ label: 'Details', value: 'WXYZA0' }])
  })

  it('keeps the raw JSON available, pretty-printed', () => {
    expect(rawDetails('{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(rawDetails({ unit: 'WXYZA0' })).toContain('"unit": "WXYZA0"')
  })
})
