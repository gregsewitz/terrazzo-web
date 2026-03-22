/**
 * Terrazzo — Place Cover Images
 *
 * Google Places CDN image URLs for all 90 demo places.
 * These are permanent CDN URLs (no API key required) resolved from
 * Google Places Photo API references.
 *
 * Images are served at 1200px width — append different size params to the
 * URL suffix to resize (e.g. change =s1600-w1200 to =s800-w800).
 */

export const PLACE_IMAGES: Record<string, string> = {
  // ── Stockholm ──────────────────────────────────────────────
  'Ett Hem': 'https://lh3.googleusercontent.com/places/ANXAkqEtnB-jN9pkccIAL7UXBx77bGzzCCDXeVKGV8anXesqXJ86MxzgvjImCLe87m0Pii-giB6MC1ddJMa1f1hgRZGbjZvmgiw9gdE=s1600-w1200',
  'Frantzén': 'https://lh3.googleusercontent.com/places/ANXAkqGU-KNtvy_0o15-cLkHfHF8TB_UOwNt4OrcAit-Zj3QL-CR8JeWQqCwTY7GmpJK9N-J5ieY2LrWPQPPATrmzCIIXlQ3Pg_XNk4=s1600-w1200',
  'Sturehof': 'https://lh3.googleusercontent.com/places/ANXAkqF1RcaniUQZzFIE3fibUhEvOKumU3ADVYgIcwFAXDWqXIyp1JiEojfShfn7p8shgqPTbnJasHSytf3iUj1H20qSchlDGe9ZRww=s1600-w1200',
  'Drop Coffee': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepqnerdy0IrElXNRtJLS0Fb5MPB2WTyPRnpuWRJW8GOep9BVnHqiGycGgUa_RBTDDI8OAbQY3ZZnDmkYi4OpNviQxfILN6sJdRhmCeUEcpu26AZP9P5X_wNwJgfiyYzs0yS8_lM=s1600-w1200',
  'Södermalm': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqwB2k76Waqb-C-X5CJdSUz6rhIwwrpI2DmMyqHi1DU1yOc6DvE8QLDivtSxQtd0JZmY9BFG2f7PAqhC1MvIdhNX-QFIyRaKk3RlqXn1W2HmgGsOF2y03RF24WznvI4GPGtbnVv=s1600-w1200',
  'Fotografiska': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqfucJ1VoZLsuiyVJBLWBXQyEkyDAJOwc7S3x-nQH-wSWA8pokmGiYnB9dQxlfcxsknDNeb1w-H5jCdRYb2vy9Gmal6Sy7ZfjfTPH5YQX-5fniEXnpf4tza20mCHtsx2ex3jBT3vmXwVytk=s1600-w1080',
  'Tjoget': 'https://lh3.googleusercontent.com/places/ANXAkqFsGJOF58QM4hG_S73vX18FUrLagnDEltMDwOA7tWD91KhmVqf7NI7CJaBg4Je25u64buiWo3pz7_zpqnE35jDEo4eaB4-eo98=s1600-w1200',
  'Woodstockholm': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqV4LLuwqQiW8TY5n3lOoYUFlEmsP5L3AE8a3sT4-uRqydoyn5Q8OtC9OqponujRtUrBtTxW_SUCGrv8QilpnDmxSaQMTiKqhObaGfBuvZMW7stBoHnSsIrDHZN_yHY4xiUy-4D=s1600-w1200',
  'Oaxen Slip': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepgaDAdpOKrlDHyimO1bzb72i47CDyL3i9LMB64RErJWhSoZKthfXYxltabFaUoqdUp87sPbZnVMnLeRHC6vknUhfLfk8DVKk3RvEhDcrMRz_j5FQLYdSKG_kl9dRosJ7qLodM=s1600-w1200',
  'Grandpa': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqAOvV0XEzfHeUM_OKYcyxcggb8uZOvT9yjJoNzEcuAhZ96JW2EeIKAGOhJA9vs3_uK-MlNpPnOgYk1cKMg8rj5ir_UUorS56jovnFB2810drGmUon6VAr3bYq8Mf_pgBdyMjfY=s1600-w1200',

  // ── Copenhagen ─────────────────────────────────────────────
  'Hotel Sanders': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepROc8bKeHlsxwDK-jLLQXLF7lmSoDrTae8ao8pDLwQX-xtMpReA89pPa-6XFRHF771OFrprp4k3iKB7ISKNGGMWFr08m_EmKzW5epzSin5YYBzF0RGDnCP0c0SKDFVPAl5rWGU=s1600-w1200',
  'Noma': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoXPqj6MStfzcLLvaQ3FuzlcJHGAsikVh3q-oGpYrbFBHB4XDZ-hqdF2Bx-TYycPEL-cRgiwtOVpu_b2AF6j3Br62l_1Y-Dx1bct5qhEExhpJTLCCWIo3Xo2q7T5Obzb9hX0UGjcUEZQLNm=s1600-w550',
  'Barr': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoa5R6cWaYjVGMjI2EnyLGXIMsIOboEsAoXc811oD9KAjWRzE9vmScJFH3mumF8yFZARCh3-jVyHjMMcPlFoLNgoufm8TqYJsiXBMTNv-oPeyse2Bvca4qqA0Ngn7KAiSqkhYkX=s1600-w1200',
  'Nørrebro': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweo4BM8jRunR19zkBiRZLhKAcyyMmMTOJEohapKyrfZRY6Ig0AxBluNQIwX5_HypQ8nwjFN2p3-CUGhu7TAsGsBajfFkZo5X3xZv3YED58LiCHrvB0aG8IDiQMSialzKxJkTcOsiLg=s1600-w1200',
  'Louisiana Museum of Modern Art': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepUIuksl1v4X2fN6ofI8rpK6ocF7FKeBHjDm9KhS8B30xGTFRawlp6DdhYsL0EbFJliitXfqammPKbstEv3Pn23we48Cu_FsZneZRnGKQB_WzFGO-Ur4dgWGQDSKuHkhCDDH3kOLQ=s1600-w1200',
  'Hart Bageri': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwerDNecy0FgFM3D5W5dKRiYRBq6dy-lVMWri8OZAgPER3BCZfhx8ZyHqSG21TYXuCKQOWmOiF6HPMsXzjB1hFeulIx94-ykI3mTAyWVD2DwYJ_uTDpRYP_MFEP3eDifZIcTwj5M=s1600-w1200',
  'Ruby': 'https://lh3.googleusercontent.com/places/ANXAkqHwHrGvnCZpktEsXZ9IILIogWJ0XY6KynFHgvCmxf9kT72A6_vMvhNa4i9vZsh00DDHvdHXY7Jw1vLW6AxlWtwb2S6LiaL9900=s1600-w1200',
  'Kadeau': 'https://lh3.googleusercontent.com/places/ANXAkqFUYmtl1PfM8bO63iazaRFXeY6TDdKGH0jTMx7Zt757on1icPBf5GHjs66aZeatcFg-_NmEQAP9rLVBStv6ZR6V_VagZhG-BNE=s1600-w1200',
  'Studio': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweo66JWav8upcrsePC0SInKY3AjI9fU5kyNdfogbTaYc2bUdEeov2OUlRn_36A27-TyI2_DO96GPeOqKnACGCOrmffyA4CwJvysm2bpH4Lr3sJKDiHPmsr4FF63unkzNvNzvWVAg=s1600-w1200',
  'Vipp Shelter': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoceFLLsYtu-xySdL08BkIlN7MfIBQs42ejRAL6Nodlb6492l-a4taJnJC0hKJjstLtLyXElRU5jQWqEx6LY5Bjr9zfwZHZPBuDFXHQrFke3Ra1DCvgeAearj6ydpHlsSDyIc0T1w=s1600-w1200',

  // ── Mexico City ────────────────────────────────────────────
  'Círculo Mexicano': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwersQZKCiGIRqPPxQ7FNZDBB_XCZYJWJVfWudZwPthctSDOkL29VQZASVcidQyAHGfFfXyt_8o-dDDJlnlZdSgAcz_3jtycK9A4jBTWa6b77C2pHSf9i7ypi8_ya4tQ8O4CN4WWDTA=s1600-w1200',
  'Contramar': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweojReP4xo3v5cGpzEob4BD8rJ2n5cbE7N8kcPUG3KUIk9PTeBEfJzoGzy-b1cOFSAf54IFVpdeZIxWbdU0z5wlhjLCd5wCcNUVXZGRJXXtsc6LPxiv81dajJ7JBccl4vzYillz0BYtIuyFD=s1600-w1035',
  'Pujol': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwerhYLrJtHpu1sUNS6DtbmOfOoHiUX__EhCo5Jb9HEeSv8eAX8F-ixyX5BTuMWNS9CTsblrhZdrz4Dlq7ZS-d-7JibGhgCTDnnN7DFllhhwaf7WVzMqWvPd8eJB1YH_LMhFy1WQCINlna2SF=s1600-w1200',
  'Museo Nacional de Antropología': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwerAOSRWMlJNRFdyOHCMzf_fJvZV5jucU5-dyBYAtngGeL8q08DkU9zSglEXPY2tGOu3a59vraW_Lcw6Mu9wmAC_SSB8VczTvXC2acrauoD4OWgYySx4bew4oG1NsS6UpH9A1sg=s1600-w1200',
  'Café de Nadie': 'https://lh3.googleusercontent.com/places/ANXAkqFAc5xoYiEDc5zUe2qEQEB-Tk4iJzjk5bES9a1X9lH_nvKL_6fvuPU9fYUIcRvU4z0hRPSaDj1yFfHOxfcO5vnVR_DM4Wfbu2M=s1600-w1200',
  'Mercado de la Merced': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweq-A1Lji1OieQIBHe1oGIxyT6qMoCxLJjKwRjHeIfcz8pcG56n7tDvcjR5-k7grDOJxtMTlpr9qMBnoHia8OH82F9hO9vpJ8P632U84CsUtlB_V0lCxAMAxvXZaivqUXs5hEy-Q=s1600-w1200',
  'El Huequito': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwerxPaAvc5zsDiBAZ_tg5WpUHCJlKqxz1-RflweoOXxd4r-kiG1HfOq-Ibs7lU6LK1BldzUx9zYK8XoLFSgk5KcfiEaIHL8LtDiuSlhJzQ9l47Lyv3Ps_miTmbgBtSOqbXLJyh8=s1600-w1200',
  'Coyoacán': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoyHdzBLGA3tsFsea6vbjSZA2DLJULMFw1EXFLcZxw7oHYEI4NYUuPkovDki6fwKEEYe0iSMrKtFTenevCvOYFDbko9l3_fKOgX5RGrXlG2NgDygn6bY6BYN7jNEq8x-E0xk5B-WQ=s1600-w1200',
  'Licorería Limantour': 'https://lh3.googleusercontent.com/places/ANXAkqEyq_6SmOioKE1R976M1H54Mk-GUV2JYZGgUaPSjIJ7m1Bi-smWjTMewc2ynq0Q3shEoE9lYEI6xmhk1q22QiiftR1YvU-wrbs=s1600-w966',
  'Onora Casa': 'https://lh3.googleusercontent.com/places/ANXAkqHnxprQk_FP06pVTr7sxP90qhIzNh0-xsujfI2w5O5zJSVHJngogae8XfIxOXQ1NY4JqRrmhcbveIIUHsDTURVDw4gTSCKTrLE=s1600-w1200',
  'Rosetta': 'https://lh3.googleusercontent.com/places/ANXAkqF2gkxEpE-OZ38fuUxvi5YvMW4QMUQL05OpJDaFkuSMp-PBzGVKtqfQlgjfbcN4_Vh66K998GVq2LO0XW8LPtnNE3FByM4HpUY=s1600-w1200',
  'Baltra Bar': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepj-W4_S2F7n2TQJhgNir17k_vm9UhlYPJyNCRs2JuS9Y9hRVEa1Psu8RJNW63pGjfHPptSunMHQQjZ9tnzpUOE7JAm80TDrX3VmWYulHhQAAAPBBtbCFuXzPekJvtc6calUI_dSg=s1600-w1200',
  'Lucha Libre Arena México': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepWHhwc9WvZ1dvxDbMzOr-XpXMsb54Vw8hvmzn_b-7kssqpbCfdCrAaGoJL8PuMojrLXOpdf4ozma5vJa549HxSiSzcumU2LTBF8pWu1c8-vlavDtktS5MzXPkrILVu0a5-OCuq=s1600-w1200',
  'Expendio de Maíz': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqEgVMBUNlzL7xZFQs4kgdzbuKmlyFRzg-mL2CPetcc67n5JZ6nl9aSRFXyhsl8_MAVH9G1E_HNoPKbxKYqBqC9HZRmQTkjxEZGzg4Rrbw7qlUPVrt9vizlVtEPuaxu4o6mw5SX=s1600-w1200',
  'Páramo': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepFjugX4-G4Is7bMwHyuByHy8x6c512XFw-JuLDnGM0vl3M1W-wJU55smdhbu3LgVOnrBEe5GB_hQ_7GSfV0BIp-uqe3b6F2nd7ligp7YM5rVS9aD95dXzGJXsJ-WQurHU97rAiSCQwe15M=s1600-w1200',
  'Lago': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweo7tVWmGKbV-BX1lDUSf902bNRSUJnpT_-8aQFja6jVknlO6YLwbf0YQA0mB03Tzi2_ZUu8ZdyW9LAfa4DQZollxNAtfs8_VaYkTUoiRbEDkInsUxCj8ZGwlRooY2OWytul3CVZcwydXp3r=s1600-w1200',
  'Máximo Bistrot': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweo3C_GQ7BjYoDzZZ4r8jm6qgk5IRbWLhcwOrBycqDNFHYxwj8gA0YK6A9FiP5BMt9s1733_he0H49j89NL__0k6V5rGcY_IZ3_xcVABp35f3Nfh7YudAzS_4KihhzCI7ZM4YpKm=s1600-w1200',
  'Museo Jumex': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweopcZfp_RwHu-TtkFr7M2J_8NxBw0oozCmqJUKHLm79U8MptFvlEdITdorXrlYmy5BpNNXxoAZZED2rmwF9-DtXVhNo0TgNkC-NK0WRGNEp-3cUl2a0UdJSVtO_Q22oMlkK0uYW=s1600-w625',
  'Mercado Roma': 'https://lh3.googleusercontent.com/places/ANXAkqEpf1OIL4APors-_sWnEOqBRkz8LLZUz8f3LHK7fhSWlv9fmMig_keEHHpXrV3gxEJdRPbK1Dugia3yjMKAWOwzJS8Sdafo158=s1600-w1200',
  'Tierra Garat': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqkpA8rgUcbYzeRZrib_w4sMFX-K896cqZ1JlbGFWIp0JciI7KEnj19uvIOvEPpRxpBuNc7MDF8sEkKvPI3uDI0mnCro9ZJvNjB5AxARQoDL9HblxorAOfpFfEaFWWLorUkK6iOuA=s1600-w1200',

  // ── Paris ──────────────────────────────────────────────────
  'Hôtel des Grands Boulevards': 'https://lh3.googleusercontent.com/places/ANXAkqF0VqFFYN9IhijS9yT84Z6DDflq_xUsFAaIu5GZw9FDxSpIvB0iL4oMPVjf3_rD3mJr7airBkZVpasDEXExZrc1bpwOhcTUGek=s1600-w1200',
  'Le Comptoir du Panthéon': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoXUseujE1vgAQUIbAEE5Wvp_bHC3fq0GCe1OQ4Hs0z7qV_9-sU8KcvUR5zpzuGxlCWVO7BMBjWkFSfqyAS7_NxNXkIWoLV_Sp9MHPVmOry7Ex4a-u28k1no9cTmyrECTnu5DsJGg=s1600-w1200',
  'Clown Bar': 'https://lh3.googleusercontent.com/places/ANXAkqEWHahcStq4pISDgE2N2SzOq3KfNE-8GdR_0n7vwstgT39TcdnL3Si-SpmjUcNFKIp1wwhp0iLQv2DlsE_QtKMEhcDq6U8DdC0=s1600-w1200',
  'Café de Flore': 'https://lh3.googleusercontent.com/places/ANXAkqEkzIBrQ_6-cd6MTpZ8-C-aAPmeh5wiBwe7WPwqdyMomybQx2QvU7bSyXXwy1RPRV7eltKmMAcntFZNTXH9MVmp759bQ5xNQko=s1600-w1080',
  'Musée de l\'Orangerie': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqwk4tk6iE2ng-IR-807Sm5e2spgK-KeP8Xp2y7N-2iP2S2uH9puH3t6GYpJ9k_7TKGiUUqKmrerNsfXkIl_cSt0D8IhwYV9Hy_G1faTZg0iWANzF2Sxiu2PYVYgdyXdqmGWpD9=s1600-w1200',
  'Le Marais': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweo3QXLuEJ3x8yQgjCQCqsEN4Gi8FOomh_Xgx5jMRiVnkVR_i_Qu6Wrpo1Adnfenc5H-4xG1oN12z3Q2GCEN-CWdBZPPlJ8tVi_QOBeihvExXCsVX09fjxuom9dVuFTkA_CfPzYZ=s1600-w1200',
  'Le Mary Celeste': 'https://lh3.googleusercontent.com/places/ANXAkqEWoO1KzwfS01MzsSZAErFh7C9WQ59UHBXyokWdKX0y0Qi4RKvzIe_-PnLV5B1sANmlnr_MIxz7_l_fBMaRpL-_D0jiQBzTJGE=s1600-w1200',
  'Septime': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoYdmP4slviyOZAg3DqVaumfYe1vJEmR0FMJETRlQQalxGCiP4C_48DkDPZadDO2TlPWcp5fnYsz-HNpUZ9v6J-FUz0xGjpGPhHQoFK6XRVJQMljItpnJ7N5u11hhH5qgngr64=s1600-w1200',
  'Merci': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoC6n-M95uVKVed-4DUYN1ZxJ6f4_i-zEeb_oIP4Nelk-lWhjBsCE9WLNPPrahRuOIap63BR7eg6-vAZkNnSHsCxp_OAjwOGHGLqmgupzxaXnflmJFrsxqtYYTLeaJ-2gDm4v_s=s1600-w1200',
  'Boot Café': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweq6VjrVsx19vkFjmhZpHLA2Nr1yidXkYvghHdM2i34INPOi6M4mqdkjvnLuYM0jqGN6EPFicgbmaJmPLpe1oyV24JHnVV9aQcMsNsh95AmfHpYvS6Q7d55fiZUkl7WeH_7G4cE=s1600-w1200',
  'Chez Janou': 'https://lh3.googleusercontent.com/places/ANXAkqGEqTzQGPnL2hddd3KSj8YZihvxi9-Ogqcetojs9BLVa6atMH5Ne84A-4QmkFUzauvbPcmCvT8yPXmucOBMAcJPjGrEOYKoLCY=s1600-w960',
  'Marché des Enfants Rouges': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqdX7IoYWo0AQCeyg1g7mOarL5FhLWbVDQIdt8ZwV0y7_0uMcROKVO0sG1i-kNv7E_Oj80viFdqLCWWG-n1kmencx7uFk8zKjhs9iDkFjaQqfjE8z5UlbbhOqvkwRWk8L11QFKvhWxAH-_L=s1600-w1200',
  'Le Rigmarole': 'https://lh3.googleusercontent.com/places/ANXAkqECspQHdkKyJ7_FRNDG-wuE5oLeDPzYqDhf0fAYfP0RXkt6-zR6x7uuGm33vsE_aVLDiDaePYrO-9JXreSsbD9yLL4_Q6hDAqc=s1600-w1200',
  'Bambou': 'https://lh3.googleusercontent.com/places/ANXAkqEp9tamtRExSfs8wsFQO_-Rw7B1OP3eiqPq--XIGsemzJ0mBCQxCWWkbrtAhoDRXmOBkSY0Dfmfvn8jptCq4xfPzcXePTp-XVY=s1600-w1200',
  'Fragments': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepWGhH9Br-q6C4uhU295p_UcmYPMCrKKL6YyoXVDz20yHk1dvhR5iwQuEmLXYo4nQqVA_P4hjNqQFONqRrPAQX5Eb3sHRG3dehLbdeYVsnd1QjbOWG5QSlTivdEkNJ5Dslee8cGpg=s1600-w1200',
  'Le Servan': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweob4LmlwOZeBHUbbbjWuuRxhwilXGLVULcT86amBO6zIMbcSrhJUCo1ccu4KhaxBW5ATph3O1EHPdTJhGbWfy4YGwKWhwPYjUaw6xPC0MIZtB-lwha9YiFOIMUi3JDkCV01034sHw=s1600-w1200',
  'Palais de Tokyo': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqmBxOKfYhM0DPnc0XN1QialAy-onuySkJCWzIf1w79R86NBFLFtLbBdQVHeafBK13FWdu6bh23-zHxFFQqdiU56QkviZvUggn5cyJIgvC1TgnMi1pMv1Sx7zjCr9zw_ckCHvOO=s1600-w1200',
  'La Fontaine de Belleville': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoNauxxgPP4tzH569EY6E_9F0q8h2SIIQZTsIpBQQDf9ufE9JHShJXVKdHt6vaFK4hhsDmJBylBrjitzqSGnYQb4aOQMioPgmlEiF23YitJu6uPXKQhxWmZUQ1PZ5AaCf6l9oBE_cQRxaG4=s1600-w1200',
  'Candelaria': 'https://lh3.googleusercontent.com/places/ANXAkqFDHmIrgM52DcjsopiIzaRPmsGG3DNrbRNiWvwsMRcnY8xAZOcMhi3b1np1rJsUsf31j0BlW031fOsEpzlUhTYz9aODYly9-x8=s1600-w1200',

  // ── Sicily ─────────────────────────────────────────────────
  'Belmond Grand Hotel Timeo': 'https://lh3.googleusercontent.com/places/ANXAkqGBSCCKjWwMhw3r-kITPCL7kfmvJhvkaJ_PoWGdgETv6pj4v9YwYmmUmGN4VOWqxK2uAn0sshvChJTTpEgkx0SqOpnrlfIVTPI=s1600-w1200',
  'Masseria Susafa': 'https://lh3.googleusercontent.com/places/ANXAkqGW0zZWdbM6EzBPu-F4nZWv1flRUvRGl6hTEDYMf5ECXXg-0Z1cun6X4G5h6vVV71sdmo96WKwNby1AgcogSXaab9vxNsdH7hc=s1600-w1200',
  'Ristorante Duomo': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweohxXWwtqR1Yz_nh4PfRSTVPfvGArfTY0sBMjBb2TP1B5o3y5gHNvROj37AtnFGU2scM-xmoBNRPUgvrodEvaIbXp9WGBDdr5Yc0deNtUER6t_NQHYdddFbn1gRjC2jAOEbhYhU=s1600-w1200',
  'Valley of the Temples': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepWLxiLlLN2dRhwgM3-aTvC-OuwBK0nOwr68u0wfm4GU5WVAG4hVMsoT7xSs7knu131ondhH123de3dtruuI_HDpbeP1DU8p0mGFi-2UHshOQ5gqOaw0cRvuOR6vOHe4HLWgPQ=s1600-w1200',
  'Ortigia': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepbGG7YpQWihxIjG2R1EZPkFFSlhPSVl3EzQTgMCXJUvqtk5cfpvJ29BeQG4swPhzERYxg8Wn1r6EL_nXAS9esEOouBpcFWcHoq-EEsRnxUdCJwh2bhm4_X35wpAehnYHHN497Zpw=s1600-w1080',
  'Trattoria da Piero': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepaW4-VsfTbc1-ngqh9G1JtluzhfnyBJ_gzkFmZzDho82gNd4Q9rQKiHF066DbmF1jm39KhqKkjULW-g2sMWOH9DTz6XdH6dGDgfFisFlB5W4BkdMQV4ySL3OVCVre_588IN5LW=s1600-w1200',
  'Scala dei Turchi': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweql6EsjZzEZoh_BxxeZsY1fZdl7TXCLdUW4Ywt4jASPkSzGt0J1vl4UW5GLahHKe3WHP4jHAaR_Iz9KR4FMWTztmVXNNZbZuGJQ_AZqe4CFbjaup_kd8OktMdbflCyH68LNwAMW=s1600-w1200',
  'Ceramiche de Simone': 'https://lh3.googleusercontent.com/places/ANXAkqE3_OSQZeiH6-N5eyapccBSCuFvowKXoYqGqBLQEPPDJ3RaiwVvo950UOXFGXThS4Yh9xKcO3CqdM1QF6gRkoiB3fPsiSdzMs0=s1600-w960',
  'Caffè Sicilia': 'https://lh3.googleusercontent.com/places/ANXAkqH5UYP_TX8r10tDq3dMrNrVUa2aaEuYUjOczAa_m7UA70IkWN3YzoId4eCtfDLwgaAqV0kB697EZwtg8kJ_yAoGB6PDTESwEA=s1600-w1200',
  'Buatta Cucina Popolana': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepHjVKeLNSA0EPdI-ricbwz4GqTzKuyqeS060mIlXVNsF7JrKM0uXJlqWeP-oScYH0wMjjjKm78BYL_ELDO9X5jrkqM6Kgci9e9uYpKrGzMbpuPa00CTWHczTk6FQ5QuSn8thAi=s1600-w1200',
  'Mt Etna': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoWUTYdl3aeUUZ9qc4z3SCmrd9eaT0-c_LZrG05wcFxSck5F3xDpxT4j6o5QvkmEyeecfKwumedkRHCC3TTw3CFXqYEAAXXxQHvl_21Jj-PYIGzYJ4sJxhffz-I-zqzCdX1Jqkh=s1600-w1200',
  'Cefalù': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepIjz-tUOGep7oJzGae1CRchLqBQpH65WL4bPofo3RZeuvRg0MSzJtzqyG2UnZHGnXEH2eLTLu4UPZN1i2pvCvRDoLe04x3uk8G-34cTHPftnoW9t4xt1XM_3hkViarkQd8SAs-=s1600-w1200',
  'Osteria Nero D\'Avola': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweo4JozoMSMV4fAcQrjoCeOu2VfY0M7r50P65hp9c87ub6tPFUxS3MsvdqMKxL7n4qyc1vraWIg4JEKE5yV7C2tfunWJ6B6TO7R-yYuSoIQoUDU4Ea01aEx0alM2GWkIHY6QKHZV5g=s1600-w1200',
  'Therasia Resort': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepQVLAdPzfCF4YZK72clyfPWuwXKUnLQ57MLyH9oQx_lk4GNw8JNyZgLVeeLoy8ezX0HIbvzUZi-OTW5xLUlHRSNGgdEedecV3dS5ZTO1pX8C54tByazNRL12TgW9Z82XR2mHw=s1600-w1200',
  'Palazzo Catanese': 'https://lh3.googleusercontent.com/places/ANXAkqG4QLFVgP-DVj1-MNEoQkCWeiiHpW0szbnctT7MCb3Egr3WLHDlwwqwKRJ-3Mt1FmUvLfbZxIq4XfU-AVuG-k6GEs1xC2MyoGM=s1600-w650',
  'Manna Noto': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweq6dwXvkRFknTG7eAvFGqLOB4hQBCmLVrkO3C5_yqWPA4NChz1JEAW8OqH2DTOdPc7VnDtW-aks1g02VvL-hVHTIFBo7mWYffcNGjKcNipZ-Z7Kp5lr0p4IJ6TAIddcOuSD7xDz=s1600-w1200',
  'Tonnara di Scopello': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweq9_WzSQllGY6f-SqAjLK9JUfOzeE09HZd7LiGKfmEppkHv8btVB3oLfoB8WqiE2-SpDzJ6tBt55tFyNZkvav0O-OlJbTXmL0Jz_eG1EAiI5A-PKgzIHczWP9ZkVq7giinYNjFT=s1600-w1200',
  'Palazzo Ferraioli': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepBjuYKgrRuomyHlZjxIqcmd2cfygIaF0etoEWU0hrb4xeSBsfRCjDEsbYaTBIfelHHUGGu-q8yhsiButed5P5XxZ1_zjRTSSliAclQgX1QkL5lJFrjMWYNNRn7ZtM-me6331jB7A=s1600-w1200',
  'La Pescheria Market': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepZuBFZQostEnCOMt0KvaLrvOWnS_VP0XtFGo99RNCbSaZgRz7oatElxwV_135MHp4PpEROfougf8nOWlAgZaZROuBCxECZWtE1Jk9F8s0hEgKy7a7QJW8peUUya5EssPQ6uy9Rdw=s1600-w720',
  'Buonivini Vineyard': 'https://lh3.googleusercontent.com/places/ANXAkqHJcay-Fgk03bN0sV2xzs7QIwBXYe_Kwiy6z4mW4dQlnaAVGMQJIgFz2GPGGwF-x_MZMCwzfpQCKoOm4WkWnZm3g8q6hvlZRbw=s1600-w900',

  // ── NYC ────────────────────────────────────────────────────
  'Via Carota': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweodkvX0Ud_1-SUkcn6JQMdg6eJT047ENTzLZEr6BknHmY0Ut97WzSlF0rL30plBivSEOW_RlqJJT-xRdvd-EDJpIGI4EG_y_yCxNv3MPIMr_7ZH6G7dzwXlZ4rjTwXwVCHoXgMCuQ=s1600-w1200',
  'Dhamaka': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwequjR3GLU8MK9OX4VrqU57p7N3X-euJBHUD9q6EUXcJwHTk991iP8RiwFJZ-CCS1hpO0kyLktpVDflgtLnfrPGU2oNlJespPSTrSJ3TI_EttthDdxURAY72q4L99vPAeFr_Hy-D=s1600-w1200',
  'Attaboy': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweru02xzx5A0rXbFgpneH7gfZn7HHHYW9g7hUrV4VcofC9pbCEDrf0pkJ5ah7HZZg4fl6LIFMXNW0YYkoBvZhRLng74J2i2PoLMx4NUZz_CivMv-VCiE6U4wbEU9oB94TdAYscTKsIj4Ey4=s1600-w1200',
  'Eleven Madison Park': 'https://lh3.googleusercontent.com/places/ANXAkqGXGc4FdlQk8kZouvOEfj82ja-ZoXcsQMWFTeYyCTTc4Km-RyoB9tDOoZwxQCtO_tI7sBYlx8fjNcBIXiaYU7uITDge1nYh-zY=s1600-w1200',
  'Di An Di': 'https://lh3.googleusercontent.com/places/ANXAkqHT7IYpsG2xnYUY5rx3FB0kmCOMLuvfw1S11bkuf2G3Jz4RSYz-2fjvIgSbBVDj28JOfA7iuGDB_1nvPgmza0aWsH5LYAM6Gw4=s1600-w1200',
  'Le Coucou': 'https://lh3.googleusercontent.com/places/ANXAkqHBV5xWZn0riTGlSPQrlKbHOt7pb7euUWg5T1UCfND_VR9jEeBv0k5PSrdMvIMljZcxVe6s9t6OyzhpLRHyO2lIAipLtrkdqEk=s1600-w1200',
  'Don Angie': 'https://lh3.googleusercontent.com/places/ANXAkqEmxQCKto2nY4Aenw3gux06WQRcdZhAy7ufT89jmEHKYrpsAJUId3n31N8NU-LI10dTohlqcJwTNSohRFKfysSMZmfhUUPXzfU=s1600-w1004',
  '4 Charles Prime Rib': 'https://lh3.googleusercontent.com/places/ANXAkqFdt0ALdJ30U3KbakoEgrjxzEr6p5EDqBrj7THOdvDNGneKibqWgzUb7jG4LGLbAvN-nFYwldFIwzBepWs-3d3ceY-PQmEBejs=s1600-w1200',

  // ── London / Venice / Amsterdam ────────────────────────────
  'Chiltern Firehouse': 'https://lh3.googleusercontent.com/places/ANXAkqFn0BNXFTBcvVLFGbCq0DH7FgY9T8KjVZPGmlR2s8aNoQqUxnln6qxlJdp9VE5LdYFwK4RzoCd7BnDsSJDAUCbUAr7AcKS4G0U=s1600-w320',
  'Aman Venice': 'https://lh3.googleusercontent.com/places/ANXAkqHq4iNMSkvt4QUKiyNoxmlx41JCX7W7-wvcXXhFp1tkD4pMTqUpIgIYSnBsRwFpNr4tXQPJAu2rjNaR0q6JHVFSqaUUS-BvF-4=s1600-w1200',
  'Bar Brutus': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoK8NclCr99cSdfpmkfTjaeD5cehmW7cxy4OE9acb-R0uh3bYI17jguwmGQ4_3LxXjuP4uktOpi-FTjVS7Cr6SgNCCaDTw2bBMrVOqP2xHVUjxFQQQGM_33bPQLpVz-00rs7s81=s1600-w1200',

  // ── Global Hotels & Experiences ──────────────────────────
  'Aman Tokyo': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqCVVBSN3W42e108lTspR2E_-1pIPnf1cCgxX2-LLfNGw4RkN5jk4yN6UeN5HHSY7j3I0JtTN1njEzLeUlGMKBRHbNzfJ7r07tnCLOw9RxRLPbcUKceKHTYQRWc1Y1h-ScpCScm=s1600-w1200',
  'Amangiri': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwep_wHd8bDVb8Ar3M9xnCGH6NxmRnsYvgTvB5ZFmXKTJYbQDuiOIqsLXR9eqVF7hbIjiHgc2HmXSh9a1iJOL-j1S6EqE4e9RXtkwDVaVPx9Gx7pRKc5OJJuZR_kpCONS8AkdoKKn=s1600-w1023',
  'Azulik': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwer7YYxcv7hJt7CKBjSc9R3hpjI8q_D9uJ0pZlI51o2MjO24gS8301kE4qbe_-7KhrCODddfJ2Qxlb1ObpxuXLXjR8Phvk6i22oItT1iydiq0knTy-FZlWmd483a0Xx-0iaUJXZpvQ=s1600-w1200',
  'Benesse House': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwerbfsWaqGG4QclY1WfU5qo9P8hCayPzTXxq3vl0XYSlIYaXbApZySZWSiH7cTTwa4xElraEHCStjJhGIah3DRF3ewKOHDlwr25tFdYd0TCJOA-1uysqk3783nYsBY3glpUM9OC2=s1600-w1200',
  'Bensley Collection': 'https://lh3.googleusercontent.com/places/ANXAkqEVl9gpJJksC5pzMzLgM7xYxX5Eh2DBHjD4heTv2sxP16F0hsX6Wk_J1-bxg8dmwBuegGRMytCAIw1Y_MCgh_Yac6BPud0snno=s1600-w1200',
  'Borgo Egnazia': 'https://lh3.googleusercontent.com/places/ANXAkqGHTaYZI9XcZ7jy0vQon5p6Y2nzBcQo7DkpjxpnTLDdwWSNVwSF5xzPkXcVAA-lwPtLYJ1BSp08lf3EQzTPsaFE2Is70s12Yl4=s1600-w1200',
  'Casa Angelina': 'https://lh3.googleusercontent.com/places/ANXAkqHYNhFJ7Cwk8FjmfB6YvwfKm_sSgQ4_GJgW8TmhOkzmmhq2u5-bkG1CxP8G3WL2c9qub2vl74tOMMyyFG1bmntKlqVTpDfJZfQ=s1600-w1200',
  'Casa Cook Rhodes': 'https://lh3.googleusercontent.com/places/ANXAkqEctLaxmrGm5k7WH68oYipiC4e60yM02UgbHLrOxH1jkGBW1rzi57sMwM3nrRxgliBx7WsWNZ1_z2LmnOVzbJTtf-U8W_80Dd4=s1600-w1200',
  'Coco-mat Athens BC': 'https://lh3.googleusercontent.com/places/ANXAkqEKLxeMY-h5sI9jUBH3XARgKqb6bUteXlP9qWtB3BHE8rSK5BGEN3AJV6YjCpUNoK-Rok5WLwxnALwAhgU7jhI0B4TKOjIGsaE=s1600-w1200',
  'Corral del Rey': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweq4P9yPSvnbies91G2_PFz_JSSBlezooptZ7Gom8D6ulQWnaQ4ln6tE-TtOeRIab7-WwGqgHqzEeZ7o3WLy6CzwBCqBwvTAsFK9onkBeZcSmMDob3B4OrHyOsUfdTvN1IX7nLkUR-rLQCwX=s1600-w1200',
  'Deplar Farm': 'https://lh3.googleusercontent.com/places/ANXAkqFNnI1YI7K0UZIWbRorvsxW9vYHYGH5HjSiDkf19GYIv37P5EsfvulNERX_cKy9FQ2CkZZV4T_-8kjemolvBpNgSJyDI-x0qTc=s1600-w1200',
  'Forestis': 'https://lh3.googleusercontent.com/places/ANXAkqEqS7UChbrCcUB8xj87wlV0EPNaIYTWoGM8TTXpOc6BzpZ5I42dy91h5KMzKj_s4VFk0Gn-_zGfriSnluHo6MEadcaARTds8kQ=s1600-w263',
  'Hoshinoya Kyoto': 'https://lh3.googleusercontent.com/places/ANXAkqHeskibpb6-YMjQLj-vJCehpHhJqQYzgcByQO2Q6AGoWV4S7Vhoud6E92saAPiU_LdE3Sy4cn51-Fi4bfSFOATR5o5HjXaRPhg=s1600-w1200',
  'Hotel Grande Bretagne': 'https://lh3.googleusercontent.com/places/ANXAkqFxacv4NjKmLX-6BrKAsV55zhY6_UKR5BISDIp3-Z3RqMAJXWfREZiNET17Nm_33G6U5WQfMGZPjBxA5z5ZgBMfmilgdUqfCdA=s1600-w480',
  'Hotel Neri': 'https://lh3.googleusercontent.com/places/ANXAkqGzvpWoYz9IbGLk4kFWUXmNEtXJsB5S7JeXHZlxoPrpCYXNVCHIgrxP5FSXm_VrIu-vXF1eiBrxd_Io_YJarxWa4hQkn_AnzN8=s1600-w1200',
  'Juvet Landscape Hotel': 'https://lh3.googleusercontent.com/places/ANXAkqHHdaHn9Uip-lk5gYy-T7OF6dcdVQ5SACejWswcWfgSY4GWEXS241SkzPS3DXLQwnwjTbg0eAHoX31ImcUzil3vVVu5Or-n8sU=s1600-w1200',
  'KOKO Nor': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoxG5TQMCMcMQJUk8A1snyA__xAu62YnODHQE-HC0HpIdfsKGwyednw8Ov7ycD6rVWHb_P6Plw1hwF7tR2YexDyCvQ0T-ngjKaHRn3_BKGXLS1usoGOsjfV38yhFzbfiiplWCCh=s1600-w1200',
  'Kaiseki Yoshikawa': 'https://lh3.googleusercontent.com/places/ANXAkqHHyPEUs8KGpEjJBzzD7Xahe8fEDtYGY7eYkKCTrN8TLotp8M1mrIg8VeWaSoZcIfi0PaOMRBX7fWAsEiTkQ_hubSvpLOxHKDw=s1600-w1000',
  'Masseria Moroseta': 'https://lh3.googleusercontent.com/places/ANXAkqH0K-5IDYtWuUQ1r3JvQccR70xLQcrrdHMp2VzGK-NPWj2oTlVnjbW-SnVG1pGV6ieNY66CDiXhiqU36zbIvj6Jv3NWThRoIdQ=s1600-w1200',
  'Masseria Torre Maizza': 'https://lh3.googleusercontent.com/places/ANXAkqEzR6XCMllp2twY-cZbHF4krZUDzXswgtAaBUEjZKYdGvzfinH44ERTB6u2ZjshJtOfmayqhnrybSBX0os-TkrW3hSyNXvnLDo=s1600-w1200',
  'Milos Breeze': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepVNQQ1Hgz0YOI02GweUCyVjlwHyt7NUpYKjUcfrtwPwukgGYAW4mEXgrPOhMAaXinwFo4t1x-zlepiEXeZlBx9icUYmaxtXT5jWM4n1UwoZ43NhWBkStFBOyuEQ92qL3gfYzlH=s1600-w1200',
  'Nabezo': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwep6HhKn8AAk9ma6OF0IiRFYAmwCt2zYz7aTrmDI08-BX8E3XJ2p-n6KmwF7CXMsPo1xiAxfEjRWz0uPDDShMvtoFFHHTklx4vSXFjK5Xv23higu2aSGqnkqyxQDFYBtFZZ8Qp0T7w=s1600-w1200',
  'Naoshima Ryokan': 'https://lh3.googleusercontent.com/places/ANXAkqEErLVp-wfihD3I8eFpdR_f0zVchvnvwWssyTefwE4Yb7hbIIr8Gr8U8P5Qn2XN0JRFuvDaaY80BFJDK52NQqDbp4Jmecl40nA=s1600-w1200',
  'Nobu Hotel Ibiza Bay': 'https://lh3.googleusercontent.com/places/ANXAkqGndysFQK-F43qsSNVi26l1_HZIv3XswjZoEyUEMwW3kijFBaFOlWs3gUIUCKXQEcswJSvAioNAgH_YvO6SrEIFrdJSrF3oqxk=s1600-w1200',
  'Noma Residence': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqfjJ3m-7HsReJ6EA3NiRaPM7YsZDaHoSkLT7QKqo1L6794lRIlZD23RSET4gJbFmCjsoqT1OTsiemg5qwrtAKXB0bKfevZlhbe3fLo9STNqVajfnhI5hty-nt31MW4eiqhRVef=s1600-w1200',
  'Paragon 700': 'https://lh3.googleusercontent.com/places/ANXAkqEIjBgp4wi5zYxjQ8WNG_fp8t75RnljWLQ19P6asiyrw9KgUpsEkb4KlM6lEykQFf3n7GbsZeKuyZAC9T43_7ln4ogRGcuOdw=s1600-w1200',
  'Park Hyatt Tokyo': 'https://lh3.googleusercontent.com/places/ANXAkqFtrNix6iD8QvhNyQ-CabGKqbhaI-g52PR3VxK5snPKbPGawMphgbFu0zMrFZ8QJMZ2hb6TLjS7EE6e68U6pG411oFXsPjK7cs=s1600-w1200',
  'Perianth Hotel': 'https://lh3.googleusercontent.com/places/ANXAkqH4fZ4pcJB-BhDlo0AzHfEqiQAeMJeosNDD7uij5rEG53iC0KZIt_wwgwIYm53N7k2Bgi3Qy6CKxxwteT3w0SJNmrQz6QkHgL0=s1600-w1200',
  'Rosewood Hong Kong': 'https://lh3.googleusercontent.com/places/ANXAkqEG1UQJkKuijUnoqN1uKJTgPrJqXgeVnkWGWmhMj22Ri4cO-84Mtg4Nw5WXfYS0ZG1zVD6qzRnUuGoVQexBeVVHHy-j07cR6rk=s1600-w1200',
  'San Giorgio': 'https://lh3.googleusercontent.com/places/ANXAkqHqKdHWGRKfGc7f73-SMkKqEEMybPIHj5XzlZIHmGOkGvnMKTCNxuqkL3jGV9h1ty_4qSA1alol2pswYJdOTEmF2wgJ4R3CI30=s1600-w1024',
  'Singita Sasakwa': 'https://lh3.googleusercontent.com/places/ANXAkqHD4rHAvus2JC8um_MrjtPjgFZ-mzxAJEteUq7TVfJJkdUp92Fd2fqU4ur7cuskpm43H9SHS7vSFZU4zy1l47pryUwjyjBLVYE=s1600-w600',
  'Soho House Barcelona': 'https://lh3.googleusercontent.com/places/ANXAkqE-hWBf08YuqNC_56sAgJucJKZC4sX96X0lcFgcJmmY_HhLhJmHLh1OMQHvx-xZo47iZl2L9OiFQho2ZMkoe3ttyWALT6Hh3ZY=s1600-w1200',
  'Sukiyabashi Jiro': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwerUrD7BgxFN1QcutVBiiGXgKM7l1UJR70mEJVZTCobF_4P05-UdDfngOslTFyo6bAUGTOcqRNsJsG_kfRlhtD-6vOaEHfSvgvB6KjWbrorjXezB4iSnQ3nwcnbijhnMfRukLNMF=s1600-w1200',
  'Teamlab Borderless': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwep2B822xg6H0Xbf3Xyf5XpBSIS4v3iZpSVSrOGCBfcCWmB1U31ouQR1V3I9lQL2a4b6_VGvvBlK0031BU7T8DUj_ILbDNilRaB9PM1VA1EbKt5bAKX5ihFs8mP_ic9owZCJkqev=s1600-w1200',
  'The Hoxton, Paris': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwep5A2oNizLF_s7Rq7s8y66eKiSjiFk6W0FkRDfPZngWSfWTP2o1oLX8W7udMlyXrzdFyd7XROOxGbrF9s9EJFaPKiSY2DKEuEixZKaK3WhOirmYbWoqY3y770DN0hX-wxBpH3_Ymg=s1600-w1200',
  'Trunk Hotel': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoPkrtqQQe7OPrs7nFmgHagKaTdbziBW-NFrU8V7BgD1FYMFWcaouQ2cvqqnrQ3xsBOMJBGyV-gYvyM-UsXLeuVM2njA3zDCvdPDG2K8ubs30tKldc1gIg8nzjejcL4ZScnaXqN=s1600-w1200',
  'Villa Lena': 'https://lh3.googleusercontent.com/places/ANXAkqFHbX9-kDWBaFEgR-ikU7dIIuK6hy7WSU225JzF-nfLinHOh_KL1Rr_fqQd5KE8EKN0o1DKbC2jDBl6Q99ZlWnm4AlPVAp01vM=s1600-w1200',
  'BnA Alter Museum': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoPkrtqQQe7OPrs7nFmgHagKaTdbziBW-NFrU8V7BgD1FYMFWcaouQ2cvqqnrQ3xsBOMJBGyV-gYvyM-UsXLeuVM2njA3zDCvdPDG2K8ubs30tKldc1gIg8nzjejcL4ZScnaXqN=s1600-w1200',
  'Hotel & Residence Ougiya': 'https://lh3.googleusercontent.com/places/ANXAkqEErLVp-wfihD3I8eFpdR_f0zVchvnvwWssyTefwE4Yb7hbIIr8Gr8U8P5Qn2XN0JRFuvDaaY80BFJDK52NQqDbp4Jmecl40nA=s1600-w1200',
  'Trunk (House)': 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweoPkrtqQQe7OPrs7nFmgHagKaTdbziBW-NFrU8V7BgD1FYMFWcaouQ2cvqqnrQ3xsBOMJBGyV-gYvyM-UsXLeuVM2njA3zDCvdPDG2K8ubs30tKldc1gIg8nzjejcL4ZScnaXqN=s1600-w1200',
};

/**
 * Helper to get an image URL for a place, with optional size override.
 * Default returns 1200px wide. Pass a smaller width for thumbnails.
 */
export function getPlaceImage(placeName: string, width: number = 1200): string | undefined {
  const url = PLACE_IMAGES[placeName];
  if (!url) return undefined;
  // Replace the size suffix to get a different resolution
  return url.replace(/=s\d+-w\d+$/, `=s${width * 2}-w${width}`);
}

/**
 * Get a place image URL or return a fallback gradient placeholder.
 */
export function getPlaceImageOrFallback(placeName: string, width: number = 1200): string {
  return getPlaceImage(placeName, width) ?? `https://via.placeholder.com/${width}x${Math.round(width * 0.67)}/d0bfa4/8a7a6a?text=${encodeURIComponent(placeName)}`;
}
