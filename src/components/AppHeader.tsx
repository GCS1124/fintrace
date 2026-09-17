import { Bookmark, BookmarkCheck, ChevronDown, FileUp, FlaskConical, LogOut, ShieldCheck } from 'lucide-react'
import type { RefObject } from 'react'
import { EXAMPLE_DATASETS } from '../data/examples'
import type { AuthIdentity } from '../auth/authContext'
import styles from './AppHeader.module.css'

interface AppHeaderProps {
  readonly hasDataset: boolean
  readonly canSaveCase: boolean
  readonly menuOpen: boolean
  readonly onToggleMenu: () => void
  readonly onSelectExample: (exampleId: string) => void
  readonly onOpenImport: () => void
  readonly onDownloadTemplate: () => void
  readonly importButtonRef: RefObject<HTMLButtonElement | null>
  readonly identity: AuthIdentity
  readonly saveState: 'idle' | 'saving' | 'saved' | 'error'
  readonly onSaveCase: () => void
  readonly onSignOut: () => void
}

export function AppHeader({
  hasDataset,
  canSaveCase,
  menuOpen,
  onToggleMenu,
  onSelectExample,
  onOpenImport,
  onDownloadTemplate,
  importButtonRef,
  identity,
  saveState,
  onSaveCase,
  onSignOut,
}: AppHeaderProps) {
  const initials = identity.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className={styles.header}>
      <div className={styles.brandGroup}>
        <div className={styles.brandMark} aria-hidden="true">
          <ShieldCheck size={19} strokeWidth={2.2} />
        </div>
        <div>
          <div className={styles.wordmark}>FINTRACE</div>
          <div className={styles.subtitle}>Investigation workspace</div>
        </div>
      </div>

      <div className={styles.headerActions}>
        {hasDataset ? (
          <button
            type="button"
            className={`${styles.saveButton} ${saveState === 'saved' ? styles.saveButtonSaved : ''}`}
            onClick={onSaveCase}
            disabled={saveState === 'saving' || !canSaveCase}
            title={canSaveCase ? 'Save the selected case to your private workspace' : 'Select a qualifying case before saving'}
          >
            {saveState === 'saved' ? <BookmarkCheck size={15} aria-hidden="true" /> : <Bookmark size={15} aria-hidden="true" />}
            <span>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : canSaveCase ? 'Save case' : 'No case'}</span>
          </button>
        ) : null}
        <div className={styles.exampleMenu}>
          <button
            type="button"
            className={`${styles.actionButton} ${menuOpen ? styles.actionButtonActive : ''}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
          >
            <FlaskConical size={15} aria-hidden="true" />
            <span className={styles.actionLabel}>{hasDataset ? 'Load example' : 'Load demo'}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div className={styles.menu} role="menu" aria-label="Synthetic examples">
              <div className={styles.menuHeading}>Synthetic examples</div>
              {EXAMPLE_DATASETS.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => onSelectExample(example.id)}
                >
                  <span>
                    <strong>{example.label}</strong>
                    <small>{example.description}</small>
                  </span>
                </button>
              ))}
              <div className={styles.menuDivider} />
              <button type="button" role="menuitem" className={styles.menuItem} onClick={onDownloadTemplate}>
                <span>
                  <strong>Download CSV template</strong>
                  <small>Use the six supported columns.</small>
                </span>
              </button>
            </div>
          ) : null}
        </div>
        <button ref={importButtonRef} type="button" className={styles.importButton} onClick={onOpenImport}>
          <FileUp size={16} aria-hidden="true" />
          Import CSV
        </button>
        <div className={styles.userMenu}>
          <div className={styles.userAvatar} aria-hidden="true">{initials}</div>
          <div className={styles.userCopy}><strong>{identity.displayName}</strong><span>{identity.mode === 'demo' ? 'Local demo' : identity.email}</span></div>
          <button type="button" className={styles.signOutButton} onClick={onSignOut} aria-label={`Sign out ${identity.displayName}`} title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
