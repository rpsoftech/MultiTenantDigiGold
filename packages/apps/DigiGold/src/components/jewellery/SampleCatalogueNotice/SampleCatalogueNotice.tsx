import styles from './SampleCatalogueNotice.module.scss';

// MainServer has no catalogue endpoints yet, so the jewellery pages can run on sample
// products. Say so, so nobody takes the designs or prices for the store's real stock.
export function SampleCatalogueNotice() {
  return (
    <p className={styles.notice} role="note">
      <strong>Sample catalogue.</strong> These designs and prices are examples,
      not this store&apos;s stock.
    </p>
  );
}
