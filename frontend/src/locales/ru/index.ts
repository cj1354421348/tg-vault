import ru from '../ru.json';
import { redesign } from './redesign';
import { uiAudit } from './uiAudit';
import { botConnection } from './botConnection';
import { mergeCatalogs } from '../../i18n/mergeCatalogs';
import { storageAccount } from './storageAccount';
export default mergeCatalogs(ru, redesign, uiAudit, botConnection, { storageAccount });
