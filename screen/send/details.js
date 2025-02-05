/* global alert */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  ActivityIndicator,
  View,
  TextInput,
  Alert,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Platform,
  Text,
  LayoutAnimation,
  FlatList,
} from 'react-native';
import { Icon } from 'react-native-elements';
import AsyncStorage from '@react-native-community/async-storage';
import {
  BlueCreateTxNavigationStyle,
  BlueButton,
  BlueBitcoinAmount,
  BlueAddressInput,
  BlueDismissKeyboardInputAccessory,
  BlueLoading,
  BlueUseAllFundsButton,
  BlueListItem,
  BlueText,
} from '../../BlueComponents';
import Modal from 'react-native-modal';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import BigNumber from 'bignumber.js';
import RNFS from 'react-native-fs';
import * as bitcoin from 'bitcoinjs-lib';

import NetworkTransactionFees, { NetworkTransactionFee } from '../../models/networkTransactionFees';
import { BitcoinUnit, Chain } from '../../models/bitcoinUnits';
import { HDSegwitBech32Wallet, LightningCustodianWallet, MultisigHDWallet, WatchOnlyWallet } from '../../class';
import { BitcoinTransaction } from '../../models/bitcoinTransactionInfo';
import DocumentPicker from 'react-native-document-picker';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';
import loc from '../../loc';
import { BlueCurrentTheme } from '../../components/themes';
import { AbstractHDElectrumWallet } from '../../class/wallets/abstract-hd-electrum-wallet';
import { BlueStorageContext } from '../../blue_modules/storage-context';
const currency = require('../../blue_modules/currency');
const prompt = require('../../blue_modules/prompt');
const fs = require('../../blue_modules/fs');

const btcAddressRx = /^[a-zA-Z0-9]{26,35}$/;

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: BlueCurrentTheme.colors.background,
  },
  root: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: BlueCurrentTheme.colors.elevated,
  },
  scrollViewContent: {
    flexDirection: 'row',
  },
  modalContent: {
    backgroundColor: BlueCurrentTheme.colors.modal,
    padding: 22,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopColor: BlueCurrentTheme.colors.borderTopColor,
    borderWidth: BlueCurrentTheme.colors.borderWidth,
    minHeight: 200,
  },
  advancedTransactionOptionsModalContent: {
    backgroundColor: BlueCurrentTheme.colors.modal,
    padding: 22,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopColor: BlueCurrentTheme.colors.borderTopColor,
    borderWidth: BlueCurrentTheme.colors.borderWidth,
    minHeight: 130,
  },
  bottomModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  feeModalItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 10,
  },
  feeModalItemActive: {
    borderRadius: 8,
    backgroundColor: BlueCurrentTheme.colors.feeLabel,
  },
  feeModalRow: {
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeModalLabel: {
    fontSize: 22,
    color: BlueCurrentTheme.colors.successColor,
    fontWeight: '600',
  },
  feeModalTime: {
    backgroundColor: BlueCurrentTheme.colors.successColor,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  feeModalTimeText: {
    color: BlueCurrentTheme.colors.background,
  },
  feeModalValue: {
    color: BlueCurrentTheme.colors.successColor,
  },
  feeModalCustom: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeModalCustomText: {
    color: BlueCurrentTheme.colors.buttonAlternativeTextColor,
    fontSize: 15,
    fontWeight: '600',
  },
  createButton: {
    marginHorizontal: 56,
    marginVertical: 16,
    maxWidth: 260,
    minHeight: 44,
  },
  select: {
    marginBottom: 24,
    alignItems: 'center',
  },
  selectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectText: {
    color: '#9aa0aa',
    fontSize: 14,
    marginRight: 8,
  },
  selectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  selectLabel: {
    color: BlueCurrentTheme.colors.buttonTextColor,
    fontSize: 14,
  },
  of: {
    alignSelf: 'flex-end',
    marginRight: 18,
    marginVertical: 8,
    color: BlueCurrentTheme.colors.feeText,
  },
  memo: {
    flexDirection: 'row',
    borderColor: BlueCurrentTheme.colors.formBorder,
    borderBottomColor: BlueCurrentTheme.colors.formBorder,
    borderWidth: 1,
    borderBottomWidth: 0.5,
    backgroundColor: BlueCurrentTheme.colors.inputBackgroundColor,
    minHeight: 44,
    height: 44,
    marginHorizontal: 20,
    alignItems: 'center',
    marginVertical: 8,
    borderRadius: 4,
  },
  memoText: {
    flex: 1,
    marginHorizontal: 8,
    minHeight: 33,
    color: '#81868e',
  },
  fee: {
    flexDirection: 'row',
    marginHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    color: BlueCurrentTheme.colors.feeText,
    fontSize: 14,
  },
  feeRow: {
    backgroundColor: BlueCurrentTheme.colors.feeLabel,
    minWidth: 40,
    height: 25,
    borderRadius: 4,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  feeValue: {
    color: BlueCurrentTheme.colors.feeValue,
  },
});

export default class SendDetails extends Component {
  static contextType = BlueStorageContext;
  state = { isLoading: true };
  scrollView = React.createRef();

  constructor(props, context) {
    super(props);

    this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this._keyboardDidShow);
    this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this._keyboardDidHide);

    /** @type {LegacyWallet} */
    let fromWallet = null;
    if (props.route.params) fromWallet = props.route.params.fromWallet;

    const wallets = context.wallets.filter(wallet => wallet.type !== LightningCustodianWallet.type);

    if (wallets.length === 0) {
      alert(loc.send.details_wallet_before_tx);
      return props.navigation.goBack(null);
    } else {
      if (!fromWallet && wallets.length > 0) {
        fromWallet = wallets[0];
      }
      this.state = {
        isLoading: false,
        showSendMax: false,
        isFeeSelectionModalVisible: false,
        isAdvancedTransactionOptionsVisible: false,
        isTransactionReplaceable: fromWallet.type === HDSegwitBech32Wallet.type,
        recipientsScrollIndex: 0,
        fromWallet,
        addresses: [],
        units: [],
        memo: '',
        networkTransactionFees: new NetworkTransactionFee(1, 1, 1),
        fee: '1',
        feePrecalc: {
          current: null,
          slowFee: null,
          mediumFee: null,
          fastestFee: null,
        },
        feeUnit: fromWallet.getPreferredBalanceUnit(),
        amountUnit: fromWallet.preferredBalanceUnit, // default for whole screen
        renderWalletSelectionButtonHidden: false,
        width: Dimensions.get('window').width,
      };
    }
  }

  renderNavigationHeader() {
    this.props.navigation.setParams({
      withAdvancedOptionsMenuButton: this.state.fromWallet.allowBatchSend() || this.state.fromWallet.allowSendMax(),
      advancedOptionsMenuButtonAction: () => {
        Keyboard.dismiss();
        this.setState({ isAdvancedTransactionOptionsVisible: true });
      },
    });
  }

  /**
   * TODO: refactor this mess, get rid of regexp, use https://github.com/bitcoinjs/bitcoinjs-lib/issues/890 etc etc
   *
   * @param data {String} Can be address or `bitcoin:xxxxxxx` uri scheme, or invalid garbage
   */
  processAddressData = data => {
    this.setState({ isLoading: true }, async () => {
      const recipients = this.state.addresses;
      const dataWithoutSchema = data.replace('bitcoin:', '').replace('BITCOIN:', '');
      if (this.state.fromWallet.isAddressValid(dataWithoutSchema)) {
        recipients[[this.state.recipientsScrollIndex]].address = dataWithoutSchema;
        const units = this.state.units;
        units[this.state.recipientsScrollIndex] = BitcoinUnit.BTC; // also resetting current unit to BTC
        this.setState({
          address: recipients,
          isLoading: false,
          amountUnit: BitcoinUnit.BTC,
          units,
        });
      } else {
        let address = '';
        let options;
        try {
          if (!data.toLowerCase().startsWith('bitcoin:')) {
            data = `bitcoin:${data}`;
          }
          const decoded = DeeplinkSchemaMatch.bip21decode(data);
          address = decoded.address;
          options = decoded.options;
        } catch (error) {
          data = data.replace(/(amount)=([^&]+)/g, '').replace(/(amount)=([^&]+)&/g, '');
          const decoded = DeeplinkSchemaMatch.bip21decode(data);
          decoded.options.amount = 0;
          address = decoded.address;
          options = decoded.options;
          this.setState({ isLoading: false });
        }
        console.log(options);
        if (btcAddressRx.test(address) || address.indexOf('bc1') === 0 || address.indexOf('BC1') === 0) {
          const units = this.state.units;
          units[this.state.recipientsScrollIndex] = BitcoinUnit.BTC; // also resetting current unit to BTC
          recipients[[this.state.recipientsScrollIndex]].address = address;
          recipients[[this.state.recipientsScrollIndex]].amount = options.amount;
          recipients[[this.state.recipientsScrollIndex]].amountSats = new BigNumber(options.amount).multipliedBy(100000000).toNumber();
          this.setState({
            addresses: recipients,
            memo: options.label || options.message,
            isLoading: false,
            amountUnit: BitcoinUnit.BTC,
            units,
            payjoinUrl: options.pj || '',
          });
        } else {
          this.setState({ isLoading: false });
        }
      }
    });
  };

  async componentDidMount() {
    this.renderNavigationHeader();
    console.log('send/details - componentDidMount');
    /** @type {BitcoinTransaction[]} */
    const addresses = [];
    let initialMemo = '';
    if (this.props.route.params.uri) {
      const uri = this.props.route.params.uri;
      try {
        const { address, amount, memo, payjoinUrl } = DeeplinkSchemaMatch.decodeBitcoinUri(uri);
        addresses.push(new BitcoinTransaction(address, amount, currency.btcToSatoshi(amount)));
        initialMemo = memo;
        this.setState({ addresses, memo: initialMemo, isLoading: false, amountUnit: BitcoinUnit.BTC, payjoinUrl });
      } catch (error) {
        console.log(error);
        alert(loc.send.details_error_decode);
      }
    } else if (this.props.route.params.address) {
      addresses.push(new BitcoinTransaction(this.props.route.params.address));
      if (this.props.route.params.memo) initialMemo = this.props.route.params.memo;
      this.setState({ addresses, memo: initialMemo, isLoading: false, amountUnit: BitcoinUnit.BTC });
    } else {
      this.setState({ addresses: [new BitcoinTransaction()], isLoading: false });
    }

    try {
      const cachedNetworkTransactionFees = JSON.parse(await AsyncStorage.getItem(NetworkTransactionFee.StorageKey));

      if (cachedNetworkTransactionFees && 'fastestFee' in cachedNetworkTransactionFees) {
        this.setState({
          fee: cachedNetworkTransactionFees.fastestFee.toString(),
          networkTransactionFees: cachedNetworkTransactionFees,
        });
      }
    } catch (_) {}

    this.reCalcTx();

    try {
      const recommendedFees = await Promise.race([NetworkTransactionFees.recommendedFees(), this.context.sleep(2000)]);
      if (recommendedFees && 'fastestFee' in recommendedFees) {
        await AsyncStorage.setItem(NetworkTransactionFee.StorageKey, JSON.stringify(recommendedFees));
        this.setState({
          fee: recommendedFees.fastestFee.toString(),
          networkTransactionFees: recommendedFees,
        });
      }
    } catch (_) {} // either sleep expired or recommendedFees threw an exception

    if (this.props.route.params.uri) {
      try {
        const { address, amount, memo, payjoinUrl } = DeeplinkSchemaMatch.decodeBitcoinUri(this.props.route.params.uri);
        this.setState({ address, amount, memo, isLoading: false, payjoinUrl });
      } catch (error) {
        console.log(error);
        this.setState({ isLoading: false });
        alert(loc.send.details_error_decode);
      }
    }

    try {
      await Promise.race([this.state.fromWallet.fetchUtxo(), this.context.sleep(6000)]);
    } catch (_) {
      // either sleep expired or fetchUtxo threw an exception
    }

    this.setState({ isLoading: false });

    this.reCalcTx();
  }

  componentWillUnmount() {
    this.keyboardDidShowListener.remove();
    this.keyboardDidHideListener.remove();
  }

  _keyboardDidShow = () => {
    this.setState({ renderWalletSelectionButtonHidden: true, isAmountToolbarVisibleForAndroid: true });
  };

  _keyboardDidHide = () => {
    this.setState({ renderWalletSelectionButtonHidden: false, isAmountToolbarVisibleForAndroid: false });
  };

  async createTransaction() {
    Keyboard.dismiss();
    this.setState({ isLoading: true });
    const requestedSatPerByte = this.state.fee;
    for (const [index, transaction] of this.state.addresses.entries()) {
      let error;
      if (!transaction.amount || transaction.amount < 0 || parseFloat(transaction.amount) === 0) {
        error = loc.send.details_amount_field_is_not_valid;
        console.log('validation error');
      } else if (!requestedSatPerByte || parseFloat(requestedSatPerByte) < 1) {
        error = loc.send.details_fee_field_is_not_valid;
        console.log('validation error');
      } else if (!transaction.address) {
        error = loc.send.details_address_field_is_not_valid;
        console.log('validation error');
      } else if (this.state.fromWallet.getBalance() - transaction.amountSats < 0) {
        // first sanity check is that sending amount is not bigger than available balance
        error = loc.send.details_total_exceeds_balance;
        console.log('validation error');
      } else if (transaction.address) {
        const address = transaction.address.trim().toLowerCase();
        if (address.startsWith('lnb') || address.startsWith('lightning:lnb')) {
          error =
            'This address appears to be for a Lightning invoice. Please, go to your Lightning wallet in order to make a payment for this invoice.';
          console.log('validation error');
        }
      }

      if (!error) {
        try {
          bitcoin.address.toOutputScript(transaction.address);
        } catch (err) {
          console.log('validation error');
          console.log(err);
          error = loc.send.details_address_field_is_not_valid;
        }
      }
      if (error) {
        this.scrollView.current.scrollToIndex({ index });
        this.setState({ isLoading: false });
        alert(error);
        ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
        return;
      }
    }

    try {
      await this.createPsbtTransaction();
    } catch (Err) {
      this.setState({ isLoading: false }, () => {
        alert(Err.message);
        ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
      });
    }
  }

  getChangeAddressFast() {
    if (this.state.changeAddress) return this.state.changeAddress; // cache

    /** @type {AbstractHDElectrumWallet|WatchOnlyWallet} */
    const wallet = this.state.fromWallet;
    let changeAddress;
    if (WatchOnlyWallet.type === wallet.type && !wallet.isHd()) {
      // plain watchonly - just get the address
      changeAddress = wallet.getAddress();
    } else if (WatchOnlyWallet.type === wallet.type || wallet instanceof AbstractHDElectrumWallet) {
      changeAddress = wallet._getInternalAddressByIndex(wallet.getNextFreeChangeAddressIndex());
    } else {
      // legacy wallets
      changeAddress = wallet.getAddress();
    }

    return changeAddress;
  }

  async getChangeAddressAsync() {
    if (this.state.changeAddress) return this.state.changeAddress; // cache

    /** @type {AbstractHDElectrumWallet|WatchOnlyWallet} */
    const wallet = this.state.fromWallet;
    let changeAddress;
    if (WatchOnlyWallet.type === wallet.type && !wallet.isHd()) {
      // plain watchonly - just get the address
      changeAddress = wallet.getAddress();
    } else {
      // otherwise, lets call widely-used getChangeAddressAsync()
      try {
        changeAddress = await Promise.race([this.context.sleep(2000), wallet.getChangeAddressAsync()]);
      } catch (_) {}

      if (!changeAddress) {
        // either sleep expired or getChangeAddressAsync threw an exception
        if (wallet instanceof AbstractHDElectrumWallet) {
          changeAddress = wallet._getInternalAddressByIndex(wallet.getNextFreeChangeAddressIndex());
        } else {
          // legacy wallets
          changeAddress = wallet.getAddress();
        }
      }
    }

    if (changeAddress) this.setState({ changeAddress }); // cache

    return changeAddress;
  }

  /**
   * Recalculating fee options by creating skeleton of future tx.
   */
  reCalcTx = (all = false) => {
    const wallet = this.state.fromWallet;
    const fees = this.state.networkTransactionFees;
    const changeAddress = this.getChangeAddressFast();
    const requestedSatPerByte = Number(this.state.fee);
    const feePrecalc = { ...this.state.feePrecalc };

    const options = all
      ? [
          { key: 'current', fee: requestedSatPerByte },
          { key: 'slowFee', fee: fees.slowFee },
          { key: 'mediumFee', fee: fees.mediumFee },
          { key: 'fastestFee', fee: fees.fastestFee },
        ]
      : [{ key: 'current', fee: requestedSatPerByte }];

    for (const opt of options) {
      let targets = [];
      for (const transaction of this.state.addresses) {
        if (transaction.amount === BitcoinUnit.MAX) {
          // single output with MAX
          targets = [{ address: transaction.address }];
          break;
        }
        const value = parseInt(transaction.amountSats);
        if (value > 0) {
          targets.push({ address: transaction.address, value });
        } else if (transaction.amount) {
          if (currency.btcToSatoshi(transaction.amount) > 0) {
            targets.push({ address: transaction.address, value: currency.btcToSatoshi(transaction.amount) });
          }
        }
      }

      // replace wrong addresses with dump
      targets = targets.map(t => {
        try {
          bitcoin.address.toOutputScript(t.address);
          return t;
        } catch (e) {
          return { ...t, address: '36JxaUrpDzkEerkTf1FzwHNE1Hb7cCjgJV' };
        }
      });

      let flag = false;
      while (true) {
        try {
          const { fee } = wallet.coinselect(
            wallet.getUtxo(),
            targets,
            opt.fee,
            changeAddress,
            this.state.isTransactionReplaceable ? HDSegwitBech32Wallet.defaultRBFSequence : HDSegwitBech32Wallet.finalRBFSequence,
          );

          feePrecalc[opt.key] = fee;
          break;
        } catch (e) {
          if (e.message.includes('Not enough') && !flag) {
            flag = true;
            // if the outputs are too big, replace them with dust
            targets = targets.map(t => ({ ...t, value: 546 }));
            continue;
          }

          feePrecalc[opt.key] = null;
          break;
        }
      }
    }

    this.setState({ feePrecalc });
  };

  async createPsbtTransaction() {
    /** @type {HDSegwitBech32Wallet} */
    const wallet = this.state.fromWallet;
    const changeAddress = await this.getChangeAddressAsync();
    const requestedSatPerByte = Number(this.state.fee);
    console.log({ requestedSatPerByte, utxo: wallet.getUtxo() });

    let targets = [];
    for (const transaction of this.state.addresses) {
      if (transaction.amount === BitcoinUnit.MAX) {
        // single output with MAX
        targets = [{ address: transaction.address }];
        break;
      }
      const value = parseInt(transaction.amountSats);
      if (value > 0) {
        targets.push({ address: transaction.address, value });
      } else if (transaction.amount) {
        if (currency.btcToSatoshi(transaction.amount) > 0) {
          targets.push({ address: transaction.address, value: currency.btcToSatoshi(transaction.amount) });
        }
      }
    }

    const { tx, fee, psbt } = wallet.createTransaction(
      wallet.getUtxo(),
      targets,
      requestedSatPerByte,
      changeAddress,
      this.state.isTransactionReplaceable ? HDSegwitBech32Wallet.defaultRBFSequence : HDSegwitBech32Wallet.finalRBFSequence,
    );

    if (wallet.type === WatchOnlyWallet.type) {
      // watch-only wallets with enabled HW wallet support have different flow. we have to show PSBT to user as QR code
      // so he can scan it and sign it. then we have to scan it back from user (via camera and QR code), and ask
      // user whether he wants to broadcast it
      this.props.navigation.navigate('PsbtWithHardwareWallet', {
        memo: this.state.memo,
        fromWallet: wallet,
        psbt,
      });
      this.setState({ isLoading: false });
      return;
    }

    if (wallet.type === MultisigHDWallet.type) {
      this.props.navigation.navigate('PsbtMultisig', {
        memo: this.state.memo,
        psbtBase64: psbt.toBase64(),
        walletId: wallet.getID(),
      });
      this.setState({ isLoading: false });
      return;
    }

    this.context.txMetadata[tx.getId()] = {
      txhex: tx.toHex(),
      memo: this.state.memo,
    };
    await this.context.saveToDisk();
    this.props.navigation.navigate('Confirm', {
      fee: new BigNumber(fee).dividedBy(100000000).toNumber(),
      memo: this.state.memo,
      fromWallet: wallet,
      tx: tx.toHex(),
      recipients: targets,
      satoshiPerByte: requestedSatPerByte,
      payjoinUrl: this.state.payjoinUrl,
      psbt,
    });
    this.setState({ isLoading: false });
  }

  onWalletSelect = wallet => {
    const changeWallet = () => {
      this.setState({ fromWallet: wallet }, () => {
        this.renderNavigationHeader();
        this.props.navigation.pop();
      });
    };
    if (this.state.addresses.length > 1 && !wallet.allowBatchSend()) {
      ReactNativeHapticFeedback.trigger('notificationWarning');
      Alert.alert(
        loc.send.details_wallet_selection,
        loc.send.details_no_multiple,
        [
          {
            text: loc._.ok,
            onPress: async () => {
              const firstTransaction =
                this.state.addresses.find(element => {
                  const feeSatoshi = new BigNumber(element.amount).multipliedBy(100000000);
                  return element.address.length > 0 && feeSatoshi > 0;
                }) || this.state.addresses[0];
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              this.setState({ addresses: [firstTransaction] }, () => changeWallet());
            },
            style: 'default',
          },
          { text: loc._.cancel, onPress: () => {}, style: 'cancel' },
        ],
        { cancelable: false },
      );
    } else if (this.state.addresses.some(element => element.amount === BitcoinUnit.MAX) && !wallet.allowSendMax()) {
      ReactNativeHapticFeedback.trigger('notificationWarning');
      Alert.alert(
        loc.send.details_wallet_selection,
        loc.send.details_no_maximum,
        [
          {
            text: loc._.ok,
            onPress: async () => {
              const firstTransaction =
                this.state.addresses.find(element => {
                  return element.amount === BitcoinUnit.MAX;
                }) || this.state.addresses[0];
              firstTransaction.amount = 0;
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              this.setState({ addresses: [firstTransaction] }, () => changeWallet());
            },
            style: 'default',
          },
          { text: loc._.cancel, onPress: () => {}, style: 'cancel' },
        ],
        { cancelable: false },
      );
    } else {
      changeWallet();
    }
  };

  renderFeeSelectionModal = () => {
    const { feePrecalc, fee, networkTransactionFees: nf } = this.state;
    const options = [
      {
        label: loc.send.fee_fast,
        time: loc.send.fee_10m,
        fee: feePrecalc.fastestFee,
        rate: nf.fastestFee,
        active: Number(fee) === nf.fastestFee,
      },
      {
        label: loc.send.fee_medium,
        time: loc.send.fee_3h,
        fee: feePrecalc.mediumFee,
        rate: nf.mediumFee,
        active: Number(fee) === nf.mediumFee,
      },
      {
        label: loc.send.fee_slow,
        time: loc.send.fee_1d,
        fee: feePrecalc.slowFee,
        rate: nf.slowFee,
        active: Number(fee) === nf.slowFee,
      },
    ];

    return (
      <Modal
        deviceHeight={Dimensions.get('window').height}
        deviceWidth={this.state.width + this.state.width / 2}
        isVisible={this.state.isFeeSelectionModalVisible}
        style={styles.bottomModal}
        onBackdropPress={() => this.setState({ isFeeSelectionModalVisible: false })}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : null}>
          <View style={styles.modalContent}>
            {options.map(({ label, time, fee, rate, active }, index) => (
              <TouchableOpacity
                key={label}
                onPress={() =>
                  this.setState(({ feePrecalc }) => {
                    feePrecalc.current = fee;
                    return { isFeeSelectionModalVisible: false, fee: rate.toString(), feePrecalc };
                  })
                }
                style={[styles.feeModalItem, active && styles.feeModalItemActive]}
              >
                <View style={styles.feeModalRow}>
                  <Text style={styles.feeModalLabel}>{label}</Text>
                  <View style={styles.feeModalTime}>
                    <Text style={styles.feeModalTimeText}>~{time}</Text>
                  </View>
                </View>
                <View style={styles.feeModalRow}>
                  <Text style={styles.feeModalValue}>{fee && this.formatFee(fee)}</Text>
                  <Text style={styles.feeModalValue}>{rate} sat/byte</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              testID="feeCustom"
              style={styles.feeModalCustom}
              onPress={async () => {
                let error = loc.send.fee_satbyte;
                while (true) {
                  let fee;

                  try {
                    fee = await prompt(loc.send.create_fee, error, true, 'numeric');
                  } catch (_) {
                    return;
                  }

                  if (!/^\d+$/.test(fee)) {
                    error = loc.send.details_fee_field_is_not_valid;
                    continue;
                  }

                  if (fee < 1) fee = '1';
                  fee = Number(fee).toString(); // this will remove leading zeros if any
                  this.setState({ fee, isFeeSelectionModalVisible: false }, this.reCalcTx);
                  return;
                }
              }}
            >
              <Text style={styles.feeModalCustomText}>{loc.send.fee_custom}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  /**
   * watch-only wallets with enabled HW wallet support have different flow. we have to show PSBT to user as QR code
   * so he can scan it and sign it. then we have to scan it back from user (via camera and QR code), and ask
   * user whether he wants to broadcast it.
   * alternatively, user can export psbt file, sign it externally and then import it
   *
   * @returns {Promise<void>}
   */
  importTransaction = async () => {
    if (this.state.fromWallet.type !== WatchOnlyWallet.type) {
      alert('Error: importing transaction in non-watchonly wallet (this should never happen)');
      return;
    }

    try {
      const res = await DocumentPicker.pick({
        type:
          Platform.OS === 'ios'
            ? ['io.bluewallet.psbt', 'io.bluewallet.psbt.txn', DocumentPicker.types.plainText, 'public.json']
            : [DocumentPicker.types.allFiles],
      });

      if (DeeplinkSchemaMatch.isPossiblySignedPSBTFile(res.uri)) {
        // we assume that transaction is already signed, so all we have to do is get txhex and pass it to next screen
        // so user can broadcast:
        const file = await RNFS.readFile(res.uri, 'ascii');
        const psbt = bitcoin.Psbt.fromBase64(file);
        const txhex = psbt.extractTransaction().toHex();

        this.props.navigation.navigate('PsbtWithHardwareWallet', {
          memo: this.state.memo,
          fromWallet: this.state.fromWallet,
          txhex,
        });
        this.setState({ isLoading: false, isAdvancedTransactionOptionsVisible: false });
      } else if (DeeplinkSchemaMatch.isPossiblyPSBTFile(res.uri)) {
        // looks like transaction is UNsigned, so we construct PSBT object and pass to next screen
        // so user can do smth with it:
        const file = await RNFS.readFile(res.uri, 'ascii');
        const psbt = bitcoin.Psbt.fromBase64(file);
        this.props.navigation.navigate('PsbtWithHardwareWallet', {
          memo: this.state.memo,
          fromWallet: this.state.fromWallet,
          psbt,
        });
        this.setState({ isLoading: false, isAdvancedTransactionOptionsVisible: false });
      } else if (DeeplinkSchemaMatch.isTXNFile(res.uri)) {
        // plain text file with txhex ready to broadcast
        const file = await RNFS.readFile(res.uri, 'ascii');
        this.props.navigation.navigate('PsbtWithHardwareWallet', {
          memo: this.state.memo,
          fromWallet: this.state.fromWallet,
          txhex: file,
        });
        this.setState({ isLoading: false, isAdvancedTransactionOptionsVisible: false });
      } else {
        alert('Unrecognized file format');
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        alert(loc.send.details_no_signed_tx);
      }
    }
  };

  askCosignThisTransaction = async () => {
    return new Promise(resolve => {
      Alert.alert(
        loc.multisig.cosign_this_transaction,
        '',
        [
          {
            text: loc._.no,
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: loc._.yes,
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false },
      );
    });
  };

  _importTransactionMultisig = async base64arg => {
    try {
      /** @type MultisigHDWallet */
      const fromWallet = this.state.fromWallet;
      const base64 = base64arg || (await fs.openSignedTransaction());
      if (!base64) return;
      const psbt = bitcoin.Psbt.fromBase64(base64); // if it doesnt throw - all good, its valid

      if (fromWallet.howManySignaturesCanWeMake() > 0 && (await this.askCosignThisTransaction())) {
        fromWallet.cosignPsbt(psbt);
      }

      this.props.navigation.navigate('PsbtMultisig', {
        memo: this.state.memo,
        psbtBase64: psbt.toBase64(),
        walletId: fromWallet.getID(),
      });
    } catch (error) {
      alert(loc.send.problem_with_psbt + ': ' + error.message);
    }
    this.setState({ isLoading: false, isAdvancedTransactionOptionsVisible: false });
  };

  importTransactionMultisig = async () => {
    return this._importTransactionMultisig();
  };

  onBarScanned = ret => {
    this.props.navigation.dangerouslyGetParent().pop();
    if (!ret.data) ret = { data: ret };
    if (ret.data.toUpperCase().startsWith('UR')) {
      alert('BC-UR not decoded. This should never happen');
    } else if (ret.data.indexOf('+') === -1 && ret.data.indexOf('=') === -1 && ret.data.indexOf('=') === -1) {
      // this looks like NOT base64, so maybe its transaction's hex
      // we dont support it in this flow
    } else {
      // psbt base64?
      return this._importTransactionMultisig(ret.data);
    }
  };

  importTransactionMultisigScanQr = async () => {
    this.setState({ isAdvancedTransactionOptionsVisible: false });
    this.props.navigation.navigate('ScanQRCodeRoot', {
      screen: 'ScanQRCode',
      params: {
        onBarScanned: this.onBarScanned,
        showFileImportButton: true,
      },
    });
  };

  handleAddRecipient = () => {
    const { addresses } = this.state;
    addresses.push(new BitcoinTransaction());
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut, () => this.scrollView.current.scrollToEnd());
    this.setState(
      {
        addresses,
        isAdvancedTransactionOptionsVisible: false,
      },
      () => {
        this.scrollView.current.scrollToEnd();
        if (this.state.addresses.length > 1) this.scrollView.current.flashScrollIndicators();
        // after adding recipient it automatically scrolls to the last one
        this.setState({ recipientsScrollIndex: this.state.addresses.length - 1 });
      },
    );
  };

  handleRemoveRecipient = () => {
    const { addresses } = this.state;
    addresses.splice(this.state.recipientsScrollIndex, 1);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState(
      {
        addresses,
        isAdvancedTransactionOptionsVisible: false,
      },
      () => {
        if (this.state.addresses.length > 1) this.scrollView.current.flashScrollIndicators();
        // after deletion it automatically scrolls to the last one
        this.setState({ recipientsScrollIndex: this.state.addresses.length - 1 });
      },
    );
  };

  renderAdvancedTransactionOptionsModal = () => {
    const isSendMaxUsed = this.state.addresses.some(element => element.amount === BitcoinUnit.MAX);
    return (
      <Modal
        deviceHeight={Dimensions.get('window').height}
        deviceWidth={this.state.width + this.state.width / 2}
        isVisible={this.state.isAdvancedTransactionOptionsVisible}
        style={styles.bottomModal}
        onBackdropPress={() => {
          Keyboard.dismiss();
          this.setState({ isAdvancedTransactionOptionsVisible: false });
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : null}>
          <View style={styles.advancedTransactionOptionsModalContent}>
            {this.state.fromWallet.allowSendMax() && (
              <BlueListItem
                testID="sendMaxButton"
                disabled={!(this.state.fromWallet.getBalance() > 0) || isSendMaxUsed}
                title={loc.send.details_adv_full}
                hideChevron
                component={TouchableOpacity}
                onPress={this.onUseAllPressed}
              />
            )}
            {this.state.fromWallet.type === HDSegwitBech32Wallet.type && (
              <BlueListItem
                title={loc.send.details_adv_fee_bump}
                Component={TouchableWithoutFeedback}
                switch={{ value: this.state.isTransactionReplaceable, onValueChange: this.onReplaceableFeeSwitchValueChanged }}
              />
            )}
            {this.state.fromWallet.type === WatchOnlyWallet.type &&
              this.state.fromWallet.isHd() &&
              this.state.fromWallet.getSecret().startsWith('zpub') && (
                <BlueListItem
                  title={loc.send.details_adv_import}
                  hideChevron
                  component={TouchableOpacity}
                  onPress={this.importTransaction}
                />
              )}
            {this.state.fromWallet.type === MultisigHDWallet.type && (
              <BlueListItem
                title={loc.send.details_adv_import}
                hideChevron
                component={TouchableOpacity}
                onPress={this.importTransactionMultisig}
              />
            )}
            {this.state.fromWallet.type === MultisigHDWallet.type && this.state.fromWallet.howManySignaturesCanWeMake() > 0 && (
              <BlueListItem
                title={loc.multisig.co_sign_transaction}
                hideChevron
                component={TouchableOpacity}
                onPress={this.importTransactionMultisigScanQr}
              />
            )}
            {this.state.fromWallet.allowBatchSend() && (
              <>
                <BlueListItem
                  disabled={isSendMaxUsed}
                  title={loc.send.details_add_rec_add}
                  hideChevron
                  component={TouchableOpacity}
                  onPress={this.handleAddRecipient}
                />
                <BlueListItem
                  title={loc.send.details_add_rec_rem}
                  hideChevron
                  disabled={this.state.addresses.length < 2}
                  component={TouchableOpacity}
                  onPress={this.handleRemoveRecipient}
                />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  onReplaceableFeeSwitchValueChanged = value => {
    this.setState({ isTransactionReplaceable: value });
  };

  scrollViewCurrentIndex = () => {
    Keyboard.dismiss();
    const offset = this.scrollView.current.contentOffset;
    if (offset) {
      const page = Math.round(offset.x / Dimensions.get('window').width);
      return page;
    }
    return 0;
  };

  renderCreateButton = () => {
    return (
      <View style={styles.createButton}>
        {this.state.isLoading ? (
          <ActivityIndicator />
        ) : (
          <BlueButton onPress={() => this.createTransaction()} title={loc.send.details_next} testID="CreateTransactionButton" />
        )}
      </View>
    );
  };

  renderWalletSelectionButton = () => {
    if (this.state.renderWalletSelectionButtonHidden) return;
    return (
      <View style={styles.select}>
        {!this.state.isLoading && (
          <TouchableOpacity
            style={styles.selectTouch}
            onPress={() =>
              this.props.navigation.navigate('SelectWallet', { onWalletSelect: this.onWalletSelect, chainType: Chain.ONCHAIN })
            }
          >
            <Text style={styles.selectText}>{loc.wallets.select_wallet.toLowerCase()}</Text>
            <Icon name="angle-right" size={18} type="font-awesome" color="#9aa0aa" />
          </TouchableOpacity>
        )}
        <View style={styles.selectWrap}>
          <TouchableOpacity
            style={styles.selectTouch}
            onPress={() =>
              this.props.navigation.navigate('SelectWallet', { onWalletSelect: this.onWalletSelect, chainType: Chain.ONCHAIN })
            }
          >
            <Text style={styles.selectLabel}>{this.state.fromWallet.getLabel()}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  renderBitcoinTransactionInfoFields = ({ item, index }) => {
    return (
      <View style={{ width: this.state.width }}>
        <BlueBitcoinAmount
          isLoading={this.state.isLoading}
          amount={item.amount ? item.amount.toString() : null}
          onAmountUnitChange={unit => {
            const units = this.state.units;
            units[index] = unit;

            const addresses = this.state.addresses;
            const item = addresses[index];

            switch (unit) {
              case BitcoinUnit.SATS:
                item.amountSats = parseInt(item.amount);
                break;
              case BitcoinUnit.BTC:
                item.amountSats = currency.btcToSatoshi(item.amount);
                break;
              case BitcoinUnit.LOCAL_CURRENCY:
                // also accounting for cached fiat->sat conversion to avoid rounding error
                item.amountSats =
                  BlueBitcoinAmount.getCachedSatoshis(item.amount) || currency.btcToSatoshi(currency.fiatToBTC(item.amount));
                break;
            }

            addresses[index] = item;
            this.setState({ units, addresses });
          }}
          onChangeText={text => {
            item.amount = text;
            switch (this.state.units[index] || this.state.amountUnit) {
              case BitcoinUnit.BTC:
                item.amountSats = currency.btcToSatoshi(item.amount);
                break;
              case BitcoinUnit.LOCAL_CURRENCY:
                item.amountSats = currency.btcToSatoshi(currency.fiatToBTC(item.amount));
                break;
              default:
              case BitcoinUnit.SATS:
                item.amountSats = parseInt(text);
                break;
            }
            const addresses = this.state.addresses;
            addresses[index] = item;
            this.setState({ addresses }, this.reCalcTx);
          }}
          unit={this.state.units[index] || this.state.amountUnit}
          inputAccessoryViewID={this.state.fromWallet.allowSendMax() ? BlueUseAllFundsButton.InputAccessoryViewID : null}
        />
        <BlueAddressInput
          onChangeText={async text => {
            text = text.trim();
            const transactions = this.state.addresses;
            const { address, amount, memo, payjoinUrl } = DeeplinkSchemaMatch.decodeBitcoinUri(text);
            item.address = address || text;
            item.amount = amount || item.amount;
            transactions[index] = item;
            this.setState({
              addresses: transactions,
              memo: memo || this.state.memo,
              isLoading: false,
              payjoinUrl,
            });
            this.reCalcTx();
          }}
          onBarScanned={this.processAddressData}
          address={item.address}
          isLoading={this.state.isLoading}
          inputAccessoryViewID={BlueDismissKeyboardInputAccessory.InputAccessoryViewID}
          launchedBy={this.props.route.name}
        />
        {this.state.addresses.length > 1 && (
          <BlueText style={styles.of}>{loc.formatString(loc._.of, { number: index + 1, total: this.state.addresses.length })}</BlueText>
        )}
      </View>
    );
  };

  onUseAllPressed = () => {
    ReactNativeHapticFeedback.trigger('notificationWarning');
    Alert.alert(
      loc.send.details_adv_full,
      loc.send.details_adv_full_sure + ' ' + (this.state.addresses.length > 1 ? loc.send.details_adv_full_remove : ''),
      [
        {
          text: loc._.ok,
          onPress: async () => {
            Keyboard.dismiss();
            const recipient = this.state.addresses[this.scrollViewCurrentIndex()];
            recipient.amount = BitcoinUnit.MAX;
            recipient.amountSats = BitcoinUnit.MAX;
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            this.setState({
              addresses: [recipient],
              units: [BitcoinUnit.BTC],
              isAdvancedTransactionOptionsVisible: false,
            });
          },
          style: 'default',
        },
        { text: loc._.cancel, onPress: () => {}, style: 'cancel' },
      ],
      { cancelable: false },
    );
  };

  formatFee = fee => {
    switch (this.state.feeUnit) {
      case BitcoinUnit.SATS:
        return fee + ' ' + BitcoinUnit.SATS;
      case BitcoinUnit.BTC:
        return currency.satoshiToBTC(fee) + ' ' + BitcoinUnit.BTC;
      case BitcoinUnit.LOCAL_CURRENCY:
        return currency.satoshiToLocalCurrency(fee);
    }
  };

  onLayout = e => {
    this.setState({ width: e.nativeEvent.layout.width });
  };

  keyExtractor = (_item, index) => `${index}`;

  render() {
    if (this.state.isLoading || typeof this.state.fromWallet === 'undefined') {
      return (
        <View style={styles.loading}>
          <BlueLoading />
        </View>
      );
    }

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.root} onLayout={this.onLayout}>
          <StatusBar barStyle="light-content" />
          <View>
            <KeyboardAvoidingView behavior="position">
              <FlatList
                keyboardShouldPersistTaps="always"
                scrollEnabled={this.state.addresses.length > 1}
                extraData={this.state.addresses}
                data={this.state.addresses}
                renderItem={this.renderBitcoinTransactionInfoFields}
                keyExtractor={this.keyExtractor}
                ref={this.scrollView}
                horizontal
                pagingEnabled
                onMomentumScrollBegin={Keyboard.dismiss}
                scrollIndicatorInsets={{ top: 0, left: 8, bottom: 0, right: 8 }}
                contentContainerStyle={styles.scrollViewContent}
              />
              <View hide={!this.state.showMemoRow} style={styles.memo}>
                <TextInput
                  onChangeText={text => this.setState({ memo: text })}
                  placeholder={loc.send.details_note_placeholder}
                  placeholderTextColor="#81868e"
                  value={this.state.memo}
                  numberOfLines={1}
                  style={styles.memoText}
                  editable={!this.state.isLoading}
                  onSubmitEditing={Keyboard.dismiss}
                  inputAccessoryViewID={BlueDismissKeyboardInputAccessory.InputAccessoryViewID}
                />
              </View>
              <TouchableOpacity
                testID="chooseFee"
                onPress={() => this.setState({ isFeeSelectionModalVisible: true }, () => this.reCalcTx(true))}
                disabled={this.state.isLoading}
                style={styles.fee}
              >
                <Text style={styles.feeLabel}>{loc.send.create_fee}</Text>
                <View style={styles.feeRow}>
                  <Text style={styles.feeValue}>
                    {this.state.feePrecalc.current ? this.formatFee(this.state.feePrecalc.current) : this.state.fee + ' sat/byte'}
                  </Text>
                </View>
              </TouchableOpacity>
              {this.renderCreateButton()}
              {this.renderFeeSelectionModal()}
              {this.renderAdvancedTransactionOptionsModal()}
            </KeyboardAvoidingView>
          </View>
          <BlueDismissKeyboardInputAccessory />
          {Platform.select({
            ios: (
              <BlueUseAllFundsButton unit={this.state.amountUnit} onUseAllPressed={this.onUseAllPressed} wallet={this.state.fromWallet} />
            ),
            android: this.state.isAmountToolbarVisibleForAndroid && (
              <BlueUseAllFundsButton unit={this.state.amountUnit} onUseAllPressed={this.onUseAllPressed} wallet={this.state.fromWallet} />
            ),
          })}

          {this.renderWalletSelectionButton()}
        </View>
      </TouchableWithoutFeedback>
    );
  }
}

SendDetails.propTypes = {
  navigation: PropTypes.shape({
    pop: PropTypes.func,
    goBack: PropTypes.func,
    navigate: PropTypes.func,
    setParams: PropTypes.func,
    dangerouslyGetParent: PropTypes.func,
  }),
  route: PropTypes.shape({
    name: PropTypes.string,
    params: PropTypes.shape({
      amount: PropTypes.number,
      address: PropTypes.string,
      satoshiPerByte: PropTypes.string,
      fromWallet: PropTypes.fromWallet,
      memo: PropTypes.string,
      uri: PropTypes.string,
    }),
  }),
};

SendDetails.navigationOptions = ({ navigation, route }) => ({
  ...BlueCreateTxNavigationStyle(navigation, route.params.withAdvancedOptionsMenuButton, route.params.advancedOptionsMenuButtonAction),
  title: loc.send.header,
});
