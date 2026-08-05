/**
 * Header control for choosing the unit system via a dropdown menu.
 */

import PreferenceMenu from './PreferenceMenu';
import { useUnitGroup } from '../hooks/useUnitGroup';
import type { UnitGroup } from '../types/unitGroup';

const UNIT_OPTIONS: { value: UnitGroup; label: string }[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'us', label: 'US' },
  { value: 'uk', label: 'UK' },
  { value: 'base', label: 'Base' },
];

/**
 * Renders a text trigger (current unit label + chevron) and a menu of unit groups.
 *
 * Preference is persisted by UnitGroupProvider via setUnitGroup.
 *
 * @returns The unit group menu control.
 */
export default function UnitGroupMenu() {
  const { unitGroup, setUnitGroup } = useUnitGroup();
  const currentLabel =
    UNIT_OPTIONS.find((option) => option.value === unitGroup)?.label ?? unitGroup;

  return (
    <PreferenceMenu
      label="Unit system"
      value={unitGroup}
      options={UNIT_OPTIONS}
      onChange={setUnitGroup}
      triggerClassName="preference-menu__trigger--text"
      triggerChildren={
        <>
          <span className="preference-menu__trigger-label">{currentLabel}</span>
          <span className="preference-menu__chevron" aria-hidden="true" />
        </>
      }
    />
  );
}
