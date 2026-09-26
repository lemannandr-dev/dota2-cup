import { reconcileBalances } from '../server/finance/reconcile';

async function main() {
	const result = await reconcileBalances();
	console.log(`Global balance: ${result.globalBalance}`);
	console.log(`Global transaction sum: ${result.globalTransactionSum}`);
	if (result.globalDelta !== 0) {
		console.error(`Global delta: ${result.globalDelta}`);
	}
	if (result.mismatches.length === 0) {
		console.log('All user balances match transaction sums.');
		process.exit(result.ok ? 0 : 1);
	}
	console.error(`${result.mismatches.length} mismatch(es):`);
	for (const row of result.mismatches) {
		console.error(
			`- ${row.displayName} (${row.userId}): balance=${row.balance}, txSum=${row.transactionSum}, delta=${row.delta}`
		);
	}
	process.exit(1);
}

void main().catch((error) => {
	console.error(error);
	process.exit(1);
});
