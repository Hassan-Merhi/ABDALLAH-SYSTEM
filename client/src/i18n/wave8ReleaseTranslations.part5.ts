import type { Phase3SharedUiEntry } from "./sharedUiPhase3TranslationTypes";

// Wave 8 release closeout, continued from part 3 (split to stay under the 900-line limit); merged right after part 3.
export const wave8ReleaseTranslationsPart5: readonly Phase3SharedUiEntry[] = [
  {
    en: "The file contains posted vouchers whose debits do not equal their credits. They cannot be imported: correct them in the source company first.",
    ar: "يحتوي الملف على سندات مرحّلة لا تتساوى مدينتها مع دائنتها. لا يمكن استيرادها: صحّحها في الشركة المصدر أولاً.",
    fr: "Le fichier contient des pièces comptabilisées dont les débits ne sont pas égaux aux crédits. Elles ne peuvent pas être importées : corrigez-les d’abord dans la société source.",
  },
  // Wave 12 (B): audit trail and destructive routes.
  {
    en: "This company has accounting history (vouchers, stock, fiscal closures or balances) and cannot be deleted. Deactivate it instead.",
    ar: "لهذه الشركة سجل محاسبي (سندات أو مخزون أو إقفالات فترات مالية أو أرصدة) ولا يمكن حذفها. قم بتعطيلها بدلاً من ذلك.",
    fr: "Cette société a un historique comptable (pièces, stock, clôtures d’exercice ou soldes) et ne peut pas être supprimée. Désactivez-la plutôt.",
  },
  {
    en: "Only an Owner of the company can delete it.",
    ar: "لا يمكن حذف الشركة إلا من قبل مالكها.",
    fr: "Seul un propriétaire de la société peut la supprimer.",
  },
  {
    en: "This orphaned POS sale has ledger or stock lines, so it is posted and cannot be permanently deleted. Delete it as a voucher instead, which keeps its history.",
    ar: "يحتوي بيع نقطة البيع اليتيم هذا على بنود قيود أو مخزون، فهو مرحّل ولا يمكن حذفه نهائياً. احذفه كسند بدلاً من ذلك، مما يحتفظ بسجله.",
    fr: "Cette vente PDV orpheline a des lignes comptables ou de stock : elle est comptabilisée et ne peut pas être supprimée définitivement. Supprimez-la plutôt comme pièce, ce qui conserve son historique.",
  },
  {
    en: "This employee is named on voucher lines, salary advances or payroll, so it cannot be permanently deleted. Keep it in Deleted Items.",
    ar: "هذا الموظف مذكور في بنود سندات أو سلف رواتب أو كشوف رواتب، لذا لا يمكن حذفه نهائياً. أبقه في العناصر المحذوفة.",
    fr: "Cet employé figure sur des lignes de pièces, des avances sur salaire ou la paie : il ne peut pas être supprimé définitivement. Conservez-le dans les éléments supprimés.",
  },
  {
    en: "This customer is named on voucher lines or sales, so it cannot be permanently deleted. Keep it in Deleted Items.",
    ar: "هذا العميل مذكور في بنود سندات أو مبيعات، لذا لا يمكن حذفه نهائياً. أبقه في العناصر المحذوفة.",
    fr: "Ce client figure sur des lignes de pièces ou des ventes : il ne peut pas être supprimé définitivement. Conservez-le dans les éléments supprimés.",
  },
  // Wave 13 (B): payables, statements, group.
  {
    en: "Ledger balance",
    ar: "رصيد الدفتر",
    fr: "Solde comptable",
  },
  {
    en: "Ledger balance (USD)",
    ar: "رصيد الدفتر (دولار أمريكي)",
    fr: "Solde comptable (USD)",
  },
  {
    en: "Ledger balance by currency",
    ar: "رصيد الدفتر حسب العملة",
    fr: "Solde comptable par devise",
  },
  {
    en: "Some ledger lines hold a foreign amount without a USD conversion",
    ar: "تحتوي بعض بنود الدفتر على مبلغ بعملة أجنبية دون تحويل إلى الدولار الأمريكي",
    fr: "Certaines lignes comptables contiennent un montant en devise sans conversion en USD",
  },
  {
    en: "Not yet in the ledger (memo)",
    ar: "غير مسجّل في الدفتر بعد (للعلم)",
    fr: "Pas encore en comptabilité (mémo)",
  },
  {
    en: "Lines without a confirmed exchange rate are listed but not totalled",
    ar: "البنود التي ليس لها سعر صرف مؤكد مدرجة ولكنها غير محتسبة في المجموع",
    fr: "Les lignes sans taux de change confirmé sont listées mais non totalisées",
  },
  {
    en: "Operational container figure (memo)",
    ar: "رقم الحاويات التشغيلي (للعلم)",
    fr: "Chiffre opérationnel des conteneurs (mémo)",
  },
  {
    en: "Intercompany difference",
    ar: "فرق بين الشركات",
    fr: "Écart intersociétés",
  },
  {
    en: "The repair plan changed since it was reviewed; review it again before applying",
    ar: "تغيّرت خطة الإصلاح منذ مراجعتها؛ راجعها مرة أخرى قبل التطبيق",
    fr: "Le plan de réparation a changé depuis sa revue ; revoyez-le avant de l’appliquer",
  },
  // Wave 15 (B): stock path refusals.
  {
    en: "A stock transfer from a location that holds no stock of the item cannot be imported after the company's perpetual inventory cut-over: there is no cost to move.",
    ar: "لا يمكن استيراد تحويل مخزون من موقع لا يحتوي على مخزون من هذا الصنف بعد بدء الجرد المستمر للشركة: لا توجد تكلفة لنقلها.",
    fr: "Un transfert de stock depuis un emplacement qui ne détient pas cet article ne peut pas être importé après le passage de la société à l’inventaire permanent : il n’y a aucun coût à transférer.",
  },
  {
    en: "This stock document cannot be restored: its stock lines were reversed and removed when it was deleted. Enter the document again instead.",
    ar: "لا يمكن استعادة مستند المخزون هذا: تم عكس بنود المخزون الخاصة به وحذفها عند حذفه. أدخل المستند مرة أخرى بدلاً من ذلك.",
    fr: "Ce document de stock ne peut pas être restauré : ses lignes de stock ont été contre-passées et supprimées lors de sa suppression. Saisissez à nouveau le document.",
  },
  {
    en: "This sale moved stock: its date cannot be moved across the company's perpetual inventory cut-over date, because its cost of goods sold would leave or enter the ledger without the stock moving.",
    ar: "حرّكت هذه المبيعة المخزون: لا يمكن نقل تاريخها عبر تاريخ بدء الجرد المستمر للشركة، لأن تكلفة البضاعة المباعة ستخرج من الدفتر أو تدخله دون أن يتحرك المخزون.",
    fr: "Cette vente a mouvementé du stock : sa date ne peut pas franchir la date de passage de la société à l’inventaire permanent, car son coût des ventes sortirait de la comptabilité ou y entrerait sans mouvement de stock.",
  },
  {
    en: "This stock item is named on stock documents, stock movements or valuation records, so it cannot be permanently deleted. Keep it in Deleted Items.",
    ar: "هذا الصنف مذكور في مستندات المخزون أو حركاته أو سجلات التقييم، لذلك لا يمكن حذفه نهائياً. أبقِه في العناصر المحذوفة.",
    fr: "Cet article figure sur des documents de stock, des mouvements de stock ou des enregistrements de valorisation : il ne peut pas être supprimé définitivement. Conservez-le dans les éléments supprimés.",
  },
  {
    en: "Only an Admin or Owner can correct the cost of stock already on hand during an offload.",
    ar: "يمكن للمسؤول أو المالك فقط تصحيح تكلفة المخزون الموجود أثناء التفريغ.",
    fr: "Seul un administrateur ou le propriétaire peut corriger le coût du stock déjà en place lors d’un déchargement.",
  },
  // Wave 15 (A): perpetual inventory readiness (services/inventory/inventoryReadinessResolution.ts,
  // offload-lifecycle/execute.ts, routes/accounting-integrity/perpetualReadinessRoutes.ts).
  {
    en: "The perpetual inventory cut-over is applied: an offload cannot be dated before the cut-over date unless it edits an offload already dated before it. Date the offload on or after the cut-over date.",
    ar: "تم تطبيق بدء الجرد المستمر: لا يمكن تأريخ التفريغ قبل تاريخ البدء إلا إذا كان تعديلاً لتفريغ مؤرخ قبله بالفعل. أرّخ التفريغ في تاريخ البدء أو بعده.",
    fr: "Le passage à l’inventaire permanent est appliqué : un déchargement ne peut pas être daté avant la date de passage, sauf s’il modifie un déchargement déjà daté avant elle. Datez le déchargement à la date de passage ou après.",
  },
  {
    en: "The inventory readiness plan changed since it was reviewed; review the preview again",
    ar: "تغيّرت خطة جاهزية المخزون منذ مراجعتها؛ راجع المعاينة مرة أخرى",
    fr: "Le plan de préparation de l’inventaire a changé depuis sa revue ; examinez à nouveau l’aperçu",
  },
  {
    en: "Nothing to apply: choose a location action or the anomaly write-off",
    ar: "لا شيء لتطبيقه: اختر إجراءً لموقع أو شطب القيم الشاذة",
    fr: "Rien à appliquer : choisissez une action sur un emplacement ou la radiation des anomalies",
  },
  {
    en: "Each action must name an orphaned location of the plan once, with the action restore or writeOff",
    ar: "يجب أن يذكر كل إجراء موقعاً يتيماً من الخطة مرة واحدة، مع الإجراء استعادة أو شطب",
    fr: "Chaque action doit désigner une seule fois un emplacement orphelin du plan, avec l’action restaurer ou radier",
  },
  {
    en: "Another company's stock also references this missing location; it cannot be resolved for one company",
    ar: "يشير مخزون شركة أخرى أيضاً إلى هذا الموقع المفقود؛ لا يمكن معالجته لشركة واحدة",
    fr: "Le stock d’une autre société fait aussi référence à cet emplacement manquant ; il ne peut pas être résolu pour une seule société",
  },
  {
    en: "Each action needs a locationId and the action restore or writeOff",
    ar: "يحتاج كل إجراء إلى معرّف الموقع والإجراء استعادة أو شطب",
    fr: "Chaque action nécessite un identifiant d’emplacement et l’action restaurer ou radier",
  },
  {
    en: "An inventory row of the plan is missing",
    ar: "أحد صفوف المخزون في الخطة مفقود",
    fr: "Une ligne de stock du plan est introuvable",
  },
  {
    en: "Paying Cash or Bank Account",
    ar: "حساب النقد أو البنك الدافع",
    fr: "Compte de caisse ou de banque payeur",
  },
  {
    en: "Choose the account that pays",
    ar: "اختر الحساب الذي يدفع",
    fr: "Choisissez le compte qui paie",
  },
  {
    en: "Posts Dr Payroll Payable / Cr this account for the net salary.",
    ar: "يقيّد مدين رواتب مستحقة الدفع / دائن هذا الحساب بصافي الراتب.",
    fr: "Comptabilise Débit Salaires à payer / Crédit ce compte pour le salaire net.",
  },
  {
    en: "Choose the cash or bank account that pays this payroll before marking it paid",
    ar: "اختر حساب النقد أو البنك الذي يدفع هذا الراتب قبل تعليمه كمدفوع",
    fr: "Choisissez le compte de caisse ou de banque qui paie cette paie avant de la marquer payée",
  },
  {
    en: "The paying account does not belong to this company",
    ar: "الحساب الدافع لا يخص هذه الشركة",
    fr: "Le compte payeur n’appartient pas à cette société",
  },
  {
    en: "The paying account cannot be the Payroll Payable account",
    ar: "لا يمكن أن يكون الحساب الدافع هو حساب الرواتب المستحقة الدفع",
    fr: "Le compte payeur ne peut pas être le compte Salaires à payer",
  },
  {
    en: "This payroll is paid. Un-mark the payment before changing its amounts.",
    ar: "هذا الراتب مدفوع. ألغِ تعليم الدفع قبل تغيير مبالغه.",
    fr: "Cette paie est payée. Annulez le paiement avant de modifier ses montants.",
  },
  {
    en: "Payroll changed concurrently. Reload and try again.",
    ar: "تم تغيير الراتب في الوقت نفسه. أعد التحميل وحاول مرة أخرى.",
    fr: "La paie a été modifiée en même temps. Rechargez et réessayez.",
  },
  {
    en: "This advance has repayments. Reverse the repayments first, then delete the advance.",
    ar: "لهذه السلفة سدادات. ألغِ السدادات أولاً، ثم احذف السلفة.",
    fr: "Cette avance a des remboursements. Annulez d’abord les remboursements, puis supprimez l’avance.",
  },
  {
    en: "Purchase order changed concurrently. Reload and try again.",
    ar: "تم تغيير أمر الشراء في الوقت نفسه. أعد التحميل وحاول مرة أخرى.",
    fr: "Le bon de commande a été modifié en même temps. Rechargez et réessayez.",
  },
  {
    en: "The purchase voucher has no goods lines to adjust; edit the purchase order instead.",
    ar: "لا يحتوي سند الشراء على بنود بضائع لتعديلها؛ عدّل أمر الشراء بدلاً من ذلك.",
    fr: "La pièce d’achat n’a pas de lignes de marchandises à ajuster ; modifiez plutôt le bon de commande.",
  },
  {
    en: "The new items total is below the purchase voucher's other lines",
    ar: "إجمالي البنود الجديد أقل من البنود الأخرى في سند الشراء",
    fr: "Le nouveau total des articles est inférieur aux autres lignes de la pièce d’achat",
  },
  {
    en: "Freight needs a purchase supplier or an own account to credit",
    ar: "يحتاج الشحن إلى مورد شراء أو حساب خاص لقيده دائناً",
    fr: "Le fret nécessite un fournisseur d’achat ou un compte propre à créditer",
  },
  {
    en: 'Advance deleted for ${worker?.fullName || "Unknown"}: $${toMoney(advance.amount).toFixed(2)}${voucherNote}',
    ar: "السلفة المحذوفة لـ{{0}}: ${{1}}{{2}}",
    fr: "Avance supprimée pour {{0}} : ${{1}}{{2}}",
  },
  {
    en: "Only an Admin or Owner can change the opening balance of an account that already has posted entries.",
    ar: "لا يمكن إلا للمسؤول أو المالك تغيير الرصيد الافتتاحي لحساب لديه قيود مرحّلة.",
    fr: "Seul un administrateur ou le propriétaire peut modifier le solde d’ouverture d’un compte qui a déjà des écritures comptabilisées.",
  },
  {
    en: "This account already has posted entries, so its type cannot be moved to another category (for example Expense to Asset). Create a new account and move the balance with a journal entry.",
    ar: "لهذا الحساب قيود مرحّلة، لذلك لا يمكن نقل نوعه إلى فئة أخرى (مثلاً من مصروف إلى أصل). أنشئ حساباً جديداً وانقل الرصيد بقيد يومية.",
    fr: "Ce compte a déjà des écritures comptabilisées : son type ne peut pas passer dans une autre catégorie (par exemple de Charge à Actif). Créez un nouveau compte et transférez le solde par une écriture de journal.",
  },
  {
    en: "This account already has voucher entries, so it cannot be moved to another company.",
    ar: "لهذا الحساب قيود سندات، لذلك لا يمكن نقله إلى شركة أخرى.",
    fr: "Ce compte a déjà des lignes de pièces : il ne peut pas être déplacé vers une autre société.",
  },
  {
    en: "Failed to save market rate",
    ar: "تعذر حفظ سعر السوق",
    fr: "Échec de l’enregistrement du cours du marché",
  },
  {
    en: "Market rate saved",
    ar: "تم حفظ سعر السوق",
    fr: "Cours du marché enregistré",
  },
  {
    en: "A market rate is already saved for today",
    ar: "تم حفظ سعر سوق لهذا اليوم مسبقاً",
    fr: "Un cours du marché est déjà enregistré pour aujourd’hui",
  },
  {
    en: "Save today's market rate",
    ar: "حفظ سعر السوق لهذا اليوم",
    fr: "Enregistrer le cours du marché du jour",
  },
  {
    en: "No rate removed",
    ar: "لم يُحذف أي سعر",
    fr: "Aucun cours supprimé",
  },
  {
    en: "Rates used by documents and recorded market rates were kept.",
    ar: "تم الإبقاء على الأسعار التي استخدمتها المستندات وأسعار السوق المسجلة.",
    fr: "Les cours utilisés par des documents et les cours du marché enregistrés ont été conservés.",
  },
  {
    en: "The reviewed plan's planHash is required to apply the repair",
    ar: "يلزم planHash الخاص بالخطة التي تمت مراجعتها لتطبيق الإصلاح",
    fr: "Le planHash du plan examiné est requis pour appliquer la réparation",
  },
  {
    en: "A three-letter non-USD currency code is required",
    ar: "يلزم رمز عملة من ثلاثة أحرف غير الدولار الأمريكي",
    fr: "Un code de devise à trois lettres autre que USD est requis",
  },
  {
    en: "Amount must be positive and at most 1,000,000,000",
    ar: "يجب أن يكون المبلغ موجباً وألا يتجاوز 1,000,000,000",
    fr: "Le montant doit être positif et ne pas dépasser 1 000 000 000",
  },
  {
    en: "${label} is not a valid amount",
    ar: "{{0}} ليس مبلغاً صالحاً",
    fr: "{{0}} n’est pas un montant valide",
  },
  {
    en: "Could not resolve Retail accounting account ${status.code}",
    ar: "تعذر تحديد حساب محاسبة التجزئة {{0}}",
    fr: "Impossible de déterminer le compte comptable de détail {{0}}",
  },
  {
    en: "This invoice is in a currency with no confirmed exchange rate on or before its date. Enter the factory exchange rate for that currency first.",
    ar: "هذه الفاتورة بعملة ليس لها سعر صرف مؤكد في تاريخها أو قبله. أدخل سعر صرف المصنع لتلك العملة أولاً.",
    fr: "Cette facture est dans une devise sans taux de change confirmé à sa date ou avant. Saisissez d’abord le taux de change de l’usine pour cette devise.",
  },
  {
    en: "Under perpetual inventory a bale must come from a costed mix. Choose the mix the bales were pressed from.",
    ar: "في ظل الجرد الدائم يجب أن تأتي البالة من خلطة لها تكلفة. اختر الخلطة التي كُبست منها البالات.",
    fr: "En inventaire permanent, une balle doit provenir d’un mélange valorisé. Choisissez le mélange dont les balles ont été pressées.",
  },
  {
    en: "The load's proforma or its customer was not found in this company.",
    ar: "لم يتم العثور على الفاتورة المبدئية للحمولة أو على عميلها في هذه الشركة.",
    fr: "La facture proforma du chargement ou son client est introuvable dans cette société.",
  },
  {
    en: "The load has no bales to invoice.",
    ar: "لا تحتوي الحمولة على بالات لإصدار فاتورة بها.",
    fr: "Le chargement ne contient aucune balle à facturer.",
  },
  {
    en: "Some bales of this load are no longer in stock. Remove them from the load before finalizing it.",
    ar: "بعض بالات هذه الحمولة لم تعد في المخزون. أزلها من الحمولة قبل إنهائها.",
    fr: "Certaines balles de ce chargement ne sont plus en stock. Retirez-les du chargement avant de le finaliser.",
  },
  {
    en: "Some bales of this load have no stock location. Set their location before finalizing the load.",
    ar: "بعض بالات هذه الحمولة ليس لها موقع مخزون. حدّد موقعها قبل إنهاء الحمولة.",
    fr: "Certaines balles de ce chargement n’ont pas d’emplacement de stock. Définissez leur emplacement avant de finaliser le chargement.",
  },
  {
    en: "Some bales of this load have an article that is not on the load's proforma, so they have no price. Add the article to the proforma before finalizing the load.",
    ar: "بعض بالات هذه الحمولة لها صنف غير موجود في الفاتورة المبدئية للحمولة، لذلك ليس لها سعر. أضف الصنف إلى الفاتورة المبدئية قبل إنهاء الحمولة.",
    fr: "Certaines balles de ce chargement ont un article absent de la facture proforma du chargement ; elles n’ont donc pas de prix. Ajoutez l’article à la proforma avant de finaliser le chargement.",
  },
  // Wave 16 (A): boot repairs and voucher hard deletes.
  {
    en: "This location still holds stock (a quantity or a value), so it cannot be permanently deleted. Move or write off the stock first, or keep it in Deleted Items.",
    ar: "لا يزال هذا الموقع يحتفظ بمخزون (كمية أو قيمة)، لذلك لا يمكن حذفه نهائياً. انقل المخزون أو اشطبه أولاً، أو أبقه في العناصر المحذوفة.",
    fr: "Cet emplacement contient encore du stock (une quantité ou une valeur) : il ne peut pas être supprimé définitivement. Transférez ou sortez d’abord le stock, ou laissez-le dans les éléments supprimés.",
  },
  {
    en: "This voucher was replaced when its source document was posted again, so it cannot be restored. The replacement is the live voucher.",
    ar: "تم استبدال هذا السند عندما أُعيد ترحيل مستنده المصدر، لذلك لا يمكن استعادته. البديل هو السند الساري.",
    fr: "Cette pièce a été remplacée lorsque son document source a été comptabilisé à nouveau : elle ne peut pas être restaurée. La pièce de remplacement est la pièce active.",
  },
  {
    en: "The insurance journal repair plan changed since it was reviewed; review it again before applying",
    ar: "تغيّرت خطة إصلاح قيود التأمين منذ مراجعتها؛ راجعها مرة أخرى قبل التطبيق",
    fr: "Le plan de correction des écritures d’assurance a changé depuis sa revue ; revoyez-le avant de l’appliquer",
  },
  {
    en: "The supplier link repair plan changed since it was reviewed; review it again before applying",
    ar: "تغيّرت خطة إصلاح روابط الموردين منذ مراجعتها؛ راجعها مرة أخرى قبل التطبيق",
    fr: "Le plan de correction des liens fournisseurs a changé depuis sa revue ; revoyez-le avant de l’appliquer",
  },
  {
    en: "An insurance journal line changed during the repair",
    ar: "تغيّر سطر في قيد تأمين أثناء الإصلاح",
    fr: "Une ligne d’écriture d’assurance a changé pendant la correction",
  },
  {
    en: "There is nothing to repair",
    ar: "لا يوجد ما يحتاج إلى إصلاح",
    fr: "Il n’y a rien à corriger",
  },
  {
    en: "asOf must be a single YYYY-MM-DD value",
    ar: "يجب أن يكون asOf تاريخاً واحداً بالصيغة YYYY-MM-DD",
    fr: "asOf doit être une seule date au format AAAA-MM-JJ",
  },
  {
    en: "kind must be customer or supplier",
    ar: "يجب أن يكون kind إما customer أو supplier",
    fr: "kind doit être customer ou supplier",
  },
  {
    en: "startDate must be on or before endDate",
    ar: "يجب أن يكون startDate في تاريخ endDate أو قبله",
    fr: "startDate doit être antérieure ou égale à endDate",
  },
  {
    en: "Unsupported payment account type",
    ar: "نوع حساب الدفع غير مدعوم",
    fr: "Type de compte de paiement non pris en charge",
  },
  {
    en: "This factory document is in a currency with no confirmed exchange rate on or before its date. Enter the dated factory exchange rate for that currency first.",
    ar: "هذا المستند الخاص بالمصنع بعملة ليس لها سعر صرف مؤكد في تاريخه أو قبله. أدخل سعر صرف المصنع المؤرخ لتلك العملة أولاً.",
    fr: "Ce document de l’usine est dans une devise sans taux de change confirmé à sa date ou avant. Saisissez d’abord le taux de change daté de l’usine pour cette devise.",
  },
  {
    en: "This cash movement reason has no account mapped. Map the reason to an account in the Retail accounting settings first.",
    ar: "لا يوجد حساب مرتبط بسبب حركة النقد هذا. اربط السبب بحساب في إعدادات محاسبة التجزئة أولاً.",
    fr: "Aucun compte n’est associé à ce motif de mouvement de caisse. Associez d’abord le motif à un compte dans les paramètres comptables du commerce de détail.",
  },
  {
    en: "This reason cannot be used for this cash movement direction.",
    ar: "لا يمكن استخدام هذا السبب لهذا الاتجاه من حركة النقد.",
    fr: "Ce motif ne peut pas être utilisé pour ce sens de mouvement de caisse.",
  },
  {
    en: "A cash movement amount can have at most two decimals.",
    ar: "يمكن أن يحتوي مبلغ حركة النقد على منزلتين عشريتين على الأكثر.",
    fr: "Le montant d’un mouvement de caisse peut avoir au plus deux décimales.",
  },
  {
    en: "A cash movement reason maps to one account: a ledger account or a bank account.",
    ar: "يرتبط سبب حركة النقد بحساب واحد: حساب دفتر أستاذ أو حساب بنكي.",
    fr: "Un motif de mouvement de caisse est associé à un seul compte : un compte général ou un compte bancaire.",
  },
  {
    en: "The Retail inventory opening has already been applied for this company.",
    ar: "تم تطبيق الرصيد الافتتاحي لمخزون التجزئة لهذه الشركة بالفعل.",
    fr: "L’ouverture du stock de détail a déjà été appliquée pour cette société.",
  },
  {
    en: "The Retail inventory opening changed since it was reviewed; review it again before applying.",
    ar: "تغيّر الرصيد الافتتاحي لمخزون التجزئة منذ مراجعته؛ راجعه مرة أخرى قبل التطبيق.",
    fr: "L’ouverture du stock de détail a changé depuis sa revue ; revoyez-la avant de l’appliquer.",
  },
  {
    en: "Retail stock documents are dated after the chosen opening date. Choose a later opening date.",
    ar: "توجد مستندات مخزون تجزئة مؤرخة بعد تاريخ الافتتاح المختار. اختر تاريخ افتتاح لاحقاً.",
    fr: "Des documents de stock de détail sont datés après la date d’ouverture choisie. Choisissez une date d’ouverture plus tardive.",
  },
  {
    en: "The Retail inventory opening date cannot be in the future.",
    ar: "لا يمكن أن يكون تاريخ الرصيد الافتتاحي لمخزون التجزئة في المستقبل.",
    fr: "La date d’ouverture du stock de détail ne peut pas être dans le futur.",
  },
  {
    en: "Cash movement reason",
    ar: "سبب حركة النقد",
    fr: "Motif du mouvement de caisse",
  },
  {
    en: "A supplier's cost per kg is no longer changed here. Bale and mix costs are changed only through the reviewed re-cost: preview the plan, then an Owner confirms it.",
    ar: "لم يعد يتم تغيير تكلفة الكيلوغرام للمورد هنا. تُغيَّر تكاليف البالات والخلطات فقط من خلال إعادة التكلفة المراجَعة: عاين الخطة، ثم يؤكدها المالك.",
    fr: "Le coût au kg d’un fournisseur n’est plus modifié ici. Les coûts des balles et des mélanges ne sont modifiés que par le recalcul des coûts revu : prévisualisez le plan, puis un propriétaire le confirme.",
  },
  {
    en: "This bale status change would change the stock value. Sell bales through a customer order or invoice, remove or write them off through Stock Removal, and press them through a pressing batch.",
    ar: "سيؤدي تغيير حالة البالة هذا إلى تغيير قيمة المخزون. بِع البالات من خلال طلب عميل أو فاتورة، وأزلها أو اشطبها من خلال إزالة المخزون، واكبسها من خلال دفعة كبس.",
    fr: "Ce changement de statut de balle modifierait la valeur du stock. Vendez les balles par une commande client ou une facture, retirez-les ou passez-les en perte via le retrait de stock, et pressez-les via un lot de pressage.",
  },
  {
    en: "This bale is factory stock or has left it. Remove or write it off through Stock Removal instead of deleting it.",
    ar: "هذه البالة من مخزون المصنع أو خرجت منه. أزلها أو اشطبها من خلال إزالة المخزون بدلاً من حذفها.",
    fr: "Cette balle fait partie du stock de l’usine ou l’a quitté. Retirez-la ou passez-la en perte via le retrait de stock au lieu de la supprimer.",
  },
  {
    en: "This voucher is one side of an intercompany transfer. It cannot be edited here: delete the transfer (both companies' vouchers are removed together) and record it again.",
    ar: "هذا السند هو أحد طرفي تحويل بين الشركات. لا يمكن تعديله هنا: احذف التحويل (يُحذف سندا الشركتين معاً) ثم سجّله من جديد.",
    fr: "Ce bon est l’un des côtés d’un transfert intersociétés. Il ne peut pas être modifié ici : supprimez le transfert (les bons des deux sociétés sont supprimés ensemble) puis enregistrez-le à nouveau.",
  },
  {
    en: "txDate must be a YYYY-MM-DD date",
    ar: "يجب أن يكون txDate تاريخاً بصيغة YYYY-MM-DD",
    fr: "txDate doit être une date au format AAAA-MM-JJ",
  },
  {
    en: "ids must be bale ids",
    ar: "يجب أن تكون المعرّفات معرّفات بالات",
    fr: "les identifiants doivent être des identifiants de balles",
  },
];
